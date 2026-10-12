"""Anchor ledger block roots to Solana devnet with Memo-program transactions.

Anyone can compare the memo `credent:v1:block:<n>:<merkle_root>` on-chain with
`/public/blocks` to confirm the public book was not rewritten after the fact.
Failures are recorded and retried; they never block the protocol.
"""

import base64
import itertools
import logging
import threading

import httpx
from solders.hash import Hash
from solders.instruction import AccountMeta, Instruction
from solders.keypair import Keypair
from solders.message import Message
from solders.pubkey import Pubkey
from solders.transaction import Transaction
from sqlalchemy import update
from sqlmodel import Session, col, select

from credent.config import Settings
from credent.crypto.keys import KeyStore
from credent.models import Block

log = logging.getLogger("credent.anchor")
MEMO_PROGRAM = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
_ids = itertools.count(1)


def memo_text(b: Block) -> str:
    return f"credent:v1:block:{b.n}:{b.merkle_root}"


class SolanaAnchor:
    def __init__(self, settings: Settings, keys: KeyStore, http: httpx.Client | None = None):
        self.enabled = settings.anchor_enabled
        self.url = settings.solana_rpc_url
        self.keypair = Keypair.from_seed(bytes(keys.get("anchor")))
        self.http = http or httpx.Client(timeout=15)
        self.last_error: str | None = None
        self.balance: int | None = None

    @property
    def address(self) -> str:
        return str(self.keypair.pubkey())

    def explorer_tx(self, sig: str) -> str:
        return f"https://explorer.solana.com/tx/{sig}?cluster=devnet"

    def _rpc(self, method: str, params: list):
        r = self.http.post(self.url, json={"jsonrpc": "2.0", "id": next(_ids), "method": method, "params": params})
        r.raise_for_status()
        body = r.json()
        if "error" in body:
            raise RuntimeError(body["error"].get("message", str(body["error"])))
        return body["result"]

    def refresh_balance(self) -> int | None:
        try:
            self.balance = self._rpc("getBalance", [self.address])["value"]
        except Exception as e:  # network trouble must not break the app
            self.last_error = f"getBalance: {e}"
        return self.balance

    def ensure_funded(self) -> None:
        if not self.enabled:
            return
        if (self.refresh_balance() or 0) < 5_000_000:
            try:
                self._rpc("requestAirdrop", [self.address, 1_000_000_000])
            except Exception as e:
                self.last_error = (f"Airdrop failed ({e}). Fund {self.address} at "
                                   "https://faucet.solana.com (devnet) to enable anchoring.")
                log.warning(self.last_error)

    def anchor(self, b: Block) -> tuple[str, str | None, str | None]:
        """Returns (status, signature, error)."""
        if not self.enabled:
            return "DISABLED", None, None
        try:
            bh = self._rpc("getLatestBlockhash", [{"commitment": "confirmed"}])["value"]["blockhash"]
            ix = Instruction(MEMO_PROGRAM, memo_text(b).encode(),
                             [AccountMeta(self.keypair.pubkey(), is_signer=True, is_writable=True)])
            blockhash = Hash.from_string(bh)
            tx = Transaction([self.keypair], Message.new_with_blockhash([ix], self.keypair.pubkey(), blockhash), blockhash)
            sig = self._rpc("sendTransaction", [base64.b64encode(bytes(tx)).decode(), {"encoding": "base64"}])
            self.last_error = None
            return "ANCHORED", sig, None
        except Exception as e:
            self.last_error = str(e)[:300]
            return "UNANCHORED", None, self.last_error

    def status(self) -> dict:
        return {"enabled": self.enabled, "cluster": "devnet", "address": self.address,
                "balance_lamports": self.balance, "last_error": self.last_error}


def anchor_pending(s: Session, anchor: SolanaAnchor, limit: int = 3) -> int:
    blocks = s.exec(select(Block).where(col(Block.anchor_status).in_(["PENDING", "UNANCHORED"]))
                    .order_by(col(Block.n)).limit(limit)).all()
    targets = [(b.n, b.merkle_root, b) for b in blocks]
    s.commit()  # release the read transaction before slow RPC calls
    for n, root, b in targets:
        status, sig, err = anchor.anchor(b)
        # Conditional write: if the world was reset (or the block otherwise replaced) while
        # the RPC was in flight, this signature belongs to a different root. Drop it.
        s.exec(
            update(Block)
            .where(Block.n == n, Block.merkle_root == root,
                   col(Block.anchor_status).in_(["PENDING", "UNANCHORED"]))
            .values(anchor_status=status, anchor_sig=sig, anchor_error=err)
        )
        s.commit()
    return len(targets)


class AnchorWorker:
    def __init__(self, engine, anchor: SolanaAnchor, interval: float = 10.0):
        self.engine, self.anchor, self.interval = engine, anchor, interval
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="anchor", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        self.anchor.ensure_funded()
        while not self._stop.wait(self.interval):
            try:
                with Session(self.engine) as s:
                    anchor_pending(s, self.anchor)
            except Exception:
                log.exception("anchor loop")
