"""Protocol-level Solana operations: mint bootstrap, faucet, deposits, server transfers.

The server's fee payer pays for every transaction (users never need SOL).
Account labels used in transfer legs:
  "mint"               -> mint_to from the cUSD mint authority
  "vault:<index>"      -> a pool's vault
  "collections"        -> omnibus lockbox that receives borrower inflows
  "treasury"           -> protocol fee account
  "custodial:<org_id>" -> server-held wallet for an organisation without its own wallet
  any base58 address   -> an external owner (destination only)
"""

import hashlib
import json
from dataclasses import dataclass

from solders.keypair import Keypair
from solders.message import Message
from solders.pubkey import Pubkey
from solders.transaction import Transaction

from credent.chain import spl
from credent.chain.client import ChainClient, ChainError
from credent.chain.custody import Custody


@dataclass(frozen=True)
class Leg:
    src: str  # label (see module docstring)
    dst: str  # label or owner address
    amount: int  # base units

    def to_dict(self) -> dict:
        return {"src": self.src, "dst": self.dst, "amount": self.amount}


def legs_json(legs: list[Leg]) -> str:
    return json.dumps([l.to_dict() for l in legs])


def legs_from_json(raw: str) -> list[Leg]:
    return [Leg(d["src"], d["dst"], d["amount"]) for d in json.loads(raw)]


def message_hash(msg: Message) -> str:
    return hashlib.sha256(bytes(msg)).hexdigest()


class ChainService:
    def __init__(self, client: ChainClient, custody: Custody, world: str):
        self.client = client
        self.custody = custody
        self.world = world
        self.fee_payer = custody.fee_payer()
        self._mint = custody.world(world, "mint")
        self.mint_authority = custody.world(world, "mint-authority")

    # ---- identities
    @property
    def cluster(self) -> str:
        return self.client.cluster

    @property
    def mint(self) -> Pubkey:
        return self._mint.pubkey()

    def keypair(self, label: str) -> Keypair:
        if label == "collections":
            return self.custody.world(self.world, "collections")
        if label == "treasury":
            return self.custody.world(self.world, "treasury")
        if label.startswith("vault:"):
            return self.custody.world(self.world, f"pool-vault:{label[6:]}")
        if label.startswith("custodial:"):
            return self.custody.world(self.world, f"custodial:{label[10:]}")
        raise ValueError(f"no keypair for label {label!r}")

    def owner(self, label_or_address: str) -> Pubkey:
        if label_or_address == "mint":
            return self.mint_authority.pubkey()
        try:
            return self.keypair(label_or_address).pubkey()
        except ValueError:
            return Pubkey.from_string(label_or_address)

    def token_account(self, label_or_address: str) -> Pubkey:
        return spl.ata(self.owner(label_or_address), self.mint)

    # ---- sending
    def _build(self, ixs: list, signers: list[Keypair]) -> tuple[Transaction, int]:
        bh, last_valid = self.client.latest_blockhash()
        msg = Message.new_with_blockhash(ixs, self.fee_payer.pubkey(), bh)
        uniq = {bytes(k.pubkey()): k for k in [self.fee_payer, *signers]}
        return Transaction(list(uniq.values()), msg, bh), last_valid

    def _send(self, ixs: list, signers: list[Keypair]) -> str:
        tx, _ = self._build(ixs, signers)
        return self.client.send(tx)

    def bootstrap(self) -> str | None:
        """Create the cUSD mint and the omnibus/treasury token accounts if missing."""
        if self.client.cluster == "local":
            self.client.airdrop(self.fee_payer.pubkey(), 100 * 10**9)
        if self.client.exists(self.mint):
            return None
        fp = self.fee_payer.pubkey()
        ixs = [
            spl.create_mint_account(fp, self.mint, self.client.rent(spl.MINT_SIZE)),
            spl.initialize_mint2(self.mint, self.mint_authority.pubkey()),
            spl.create_ata_idempotent(fp, self.owner("collections"), self.mint),
            spl.create_ata_idempotent(fp, self.owner("treasury"), self.mint),
        ]
        return self._send(ixs, [self._mint])

    def ensure_account(self, label_or_address: str) -> str | None:
        if self.client.exists(self.token_account(label_or_address)):
            return None
        return self._send([spl.create_ata_idempotent(self.fee_payer.pubkey(), self.owner(label_or_address), self.mint)], [])

    def transfer_instructions(self, legs: list[Leg]) -> tuple[list, list[Keypair]]:
        fp = self.fee_payer.pubkey()
        ixs, signers, created = [], [], set()
        for leg in legs:
            dst_owner = self.owner(leg.dst)
            if bytes(dst_owner) not in created:
                ixs.append(spl.create_ata_idempotent(fp, dst_owner, self.mint))
                created.add(bytes(dst_owner))
            if leg.src == "mint":
                ixs.append(spl.mint_to_checked(self.mint, spl.ata(dst_owner, self.mint),
                                               self.mint_authority.pubkey(), leg.amount))
                signers.append(self.mint_authority)
            else:
                kp = self.keypair(leg.src)
                ixs.append(spl.transfer_checked(spl.ata(kp.pubkey(), self.mint), self.mint,
                                                spl.ata(dst_owner, self.mint), kp.pubkey(), leg.amount))
                signers.append(kp)
        return ixs, signers

    def execute(self, legs: list[Leg]) -> str:
        ixs, signers = self.transfer_instructions(legs)
        return self._send(ixs, signers)

    def build(self, legs: list[Leg]) -> tuple[Transaction, int]:
        """Signed transfer transaction (not sent) and the block height after which it can no longer land."""
        ixs, signers = self.transfer_instructions(legs)
        return self._build(ixs, signers)

    # ---- user-signed deposits
    def build_user_transfer(self, from_owner: Pubkey, dst_label: str, amount: int, memo: str,
                            extra_signers: list[Keypair] = ()) -> tuple[Transaction, str, int]:
        """A transfer the user signs; the fee payer signs now. Returns (tx, message_hash, last_valid_height)."""
        bh, last_valid = self.client.latest_blockhash()
        dst = self.token_account(dst_label)
        ixs = [
            spl.create_ata_idempotent(self.fee_payer.pubkey(), self.owner(dst_label), self.mint),
            spl.transfer_checked(spl.ata(from_owner, self.mint), self.mint, dst, from_owner, amount),
            spl.memo(memo, [from_owner]),
        ]
        msg = Message.new_with_blockhash(ixs, self.fee_payer.pubkey(), bh)
        tx = Transaction.new_unsigned(msg)
        tx.partial_sign([self.fee_payer, *extra_signers], bh)
        return tx, message_hash(msg), last_valid

    def validate_user_transfer(self, raw: bytes, expected_hash: str) -> Transaction:
        """Decode a wallet-signed transaction and prove it is exactly what we prepared.
        Callers record `tx.signatures[0]` before sending so a failed send can still be confirmed."""
        try:
            tx = Transaction.from_bytes(raw)
        except Exception as e:  # noqa: BLE001 - malformed bytes from the client
            raise ChainError(f"Could not decode the signed transaction: {e}") from e
        if message_hash(tx.message) != expected_hash:
            raise ChainError("The wallet altered the transaction. Please try again.")
        try:
            tx.verify()
        except Exception as e:  # noqa: BLE001
            raise ChainError("Transaction signatures are missing or invalid.") from e
        return tx

    # ---- reads
    def balance(self, label_or_address: str) -> int:
        return self.client.token_balance(self.token_account(label_or_address)) or 0
