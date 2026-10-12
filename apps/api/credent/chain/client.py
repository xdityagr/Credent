"""Chain clients: devnet JSON-RPC and an in-process LiteSVM with the same interface.

CHAIN_MODE=local runs the whole protocol against LiteSVM (real SPL programs,
no network; state lives in memory). CHAIN_MODE=devnet talks to Solana devnet.
"""

import base64
import itertools
import time
from dataclasses import dataclass
from typing import Protocol

import httpx
from solders.hash import Hash
from solders.pubkey import Pubkey
from solders.transaction import Transaction

from credent.chain.spl import token_amount

_ids = itertools.count(1)


@dataclass
class SigStatus:
    confirmed: bool
    err: str | None


class ChainClient(Protocol):
    cluster: str

    def latest_blockhash(self) -> tuple[Hash, int]: ...
    def block_height(self) -> int: ...
    def send(self, tx: Transaction) -> str: ...
    def status(self, sig: str) -> SigStatus | None: ...
    def token_delta(self, sig: str, account: Pubkey) -> int | None: ...
    def token_balance(self, account: Pubkey) -> int | None: ...
    def exists(self, account: Pubkey) -> bool: ...
    def sol_balance(self, account: Pubkey) -> int: ...
    def airdrop(self, account: Pubkey, lamports: int) -> None: ...
    def rent(self, size: int) -> int: ...


class ChainError(Exception):
    pass


class LiteChain:
    """In-process Solana VM. Transactions settle synchronously."""

    cluster = "local"

    def __init__(self) -> None:
        from solders.litesvm import LiteSVM

        self.svm = LiteSVM()
        self._results: dict[str, SigStatus] = {}
        self._deltas: dict[str, dict[str, int]] = {}

    def latest_blockhash(self) -> tuple[Hash, int]:
        return self.svm.latest_blockhash(), self.block_height() + 150

    def block_height(self) -> int:
        return self.svm.get_clock().slot

    def send(self, tx: Transaction) -> str:
        from solders.transaction_metadata import FailedTransactionMetadata

        keys = list(tx.message.account_keys)
        before = {str(k): self.token_balance(k) for k in keys}
        res = self.svm.send_transaction(tx)
        sig = str(tx.signatures[0])
        if isinstance(res, FailedTransactionMetadata):
            self._results[sig] = SigStatus(False, str(res.err))
            raise ChainError(f"transaction failed: {res.err}")
        self._results[sig] = SigStatus(True, None)
        after = {str(k): self.token_balance(k) for k in keys}
        self._deltas[sig] = {k: (after[k] or 0) - (before[k] or 0) for k in after}
        self.svm.expire_blockhash()
        return sig

    def status(self, sig: str) -> SigStatus | None:
        return self._results.get(sig)

    def token_delta(self, sig: str, account: Pubkey) -> int | None:
        d = self._deltas.get(sig)
        return None if d is None else d.get(str(account), 0)

    def token_balance(self, account: Pubkey) -> int | None:
        acct = self.svm.get_account(account)
        if acct is None or len(acct.data) < 72:
            return None
        return token_amount(acct.data)

    def exists(self, account: Pubkey) -> bool:
        return self.svm.get_account(account) is not None

    def sol_balance(self, account: Pubkey) -> int:
        return self.svm.get_balance(account) or 0

    def airdrop(self, account: Pubkey, lamports: int) -> None:
        self.svm.airdrop(account, lamports)

    def rent(self, size: int) -> int:
        return self.svm.minimum_balance_for_rent_exemption(size)


class RpcChain:
    """Solana JSON-RPC (devnet) with retry/backoff on rate limits."""

    def __init__(self, url: str, http: httpx.Client | None = None, cluster: str = "devnet"):
        self.url = url
        self.cluster = cluster
        self.http = http or httpx.Client(timeout=20)

    def call(self, method: str, params: list, retries: int = 4):
        delay = 0.6
        for attempt in range(retries + 1):
            try:
                r = self.http.post(self.url, json={"jsonrpc": "2.0", "id": next(_ids), "method": method, "params": params})
                if r.status_code in (429, 502, 503, 504) and attempt < retries:
                    time.sleep(delay)
                    delay *= 2
                    continue
                r.raise_for_status()
                body = r.json()
                if "error" in body:
                    raise ChainError(body["error"].get("message", str(body["error"])))
                return body["result"]
            except httpx.TransportError as e:
                if attempt >= retries:
                    raise ChainError(f"RPC unreachable: {e}") from e
                time.sleep(delay)
                delay *= 2
        raise ChainError("RPC retries exhausted")

    def latest_blockhash(self) -> tuple[Hash, int]:
        v = self.call("getLatestBlockhash", [{"commitment": "confirmed"}])["value"]
        return Hash.from_string(v["blockhash"]), v["lastValidBlockHeight"]

    def block_height(self) -> int:
        return self.call("getBlockHeight", [{"commitment": "confirmed"}])

    def send(self, tx: Transaction) -> str:
        return self.call("sendTransaction", [base64.b64encode(bytes(tx)).decode(),
                                             {"encoding": "base64", "preflightCommitment": "confirmed"}])

    def status(self, sig: str) -> SigStatus | None:
        v = self.call("getSignatureStatuses", [[sig], {"searchTransactionHistory": True}])["value"][0]
        if v is None:
            return None
        if v.get("err"):
            return SigStatus(False, str(v["err"]))
        return SigStatus(v.get("confirmationStatus") in ("confirmed", "finalized"), None)

    def token_delta(self, sig: str, account: Pubkey) -> int | None:
        tx = self.call("getTransaction", [sig, {"encoding": "jsonParsed", "commitment": "confirmed",
                                                "maxSupportedTransactionVersion": 0}])
        if tx is None or tx["meta"] is None:
            return None
        keys = [k["pubkey"] if isinstance(k, dict) else k for k in tx["transaction"]["message"]["accountKeys"]]
        if str(account) not in keys:
            return 0
        idx = keys.index(str(account))

        def amt(rows):
            for b in rows or []:
                if b["accountIndex"] == idx:
                    return int(b["uiTokenAmount"]["amount"])
            return 0

        return amt(tx["meta"].get("postTokenBalances")) - amt(tx["meta"].get("preTokenBalances"))

    def token_balance(self, account: Pubkey) -> int | None:
        try:
            return int(self.call("getTokenAccountBalance", [str(account)])["value"]["amount"])
        except ChainError:
            return None

    def exists(self, account: Pubkey) -> bool:
        return self.call("getAccountInfo", [str(account), {"encoding": "base64"}])["value"] is not None

    def sol_balance(self, account: Pubkey) -> int:
        return self.call("getBalance", [str(account)])["value"]

    def airdrop(self, account: Pubkey, lamports: int) -> None:
        self.call("requestAirdrop", [str(account), lamports], retries=0)

    def rent(self, size: int) -> int:
        return self.call("getMinimumBalanceForRentExemption", [size])


def explorer_tx(sig: str, cluster: str) -> str | None:
    if cluster == "local" or not sig:
        return None
    return f"https://explorer.solana.com/tx/{sig}?cluster={cluster}"


def explorer_address(addr: str, cluster: str) -> str | None:
    if cluster == "local" or not addr:
        return None
    return f"https://explorer.solana.com/address/{addr}?cluster={cluster}"
