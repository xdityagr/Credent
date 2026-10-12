"""Outbox for server-originated SPL transfers (drawdowns, settlements, withdrawals, payouts, inflow mints).

The book is updated in the same DB transaction that enqueues the transfer; this
worker moves the tokens and records the confirmation. Public kinds get a
`TransferConfirmed` ledger event with the Solana signature.
"""

import json

from sqlmodel import Session, col, select

from credent import ledger
from credent.chain.client import ChainError
from credent.chain.service import ChainService, Leg, legs_from_json, legs_json
from credent.auth.security import now
from credent.models import ChainTransfer
from credent.services import clock

# Drawdowns are not published: their signature would link a borrower pseudonym to its wallet.
PUBLIC_KINDS = ("SETTLEMENT", "WITHDRAWAL", "DEPOSIT_REFUND")
MAX_ATTEMPTS = 6


def enqueue(s: Session, kind: str, legs: list[Leg], ref_type: str = "", ref_id: str = "",
            org_id: str | None = None, meta: dict | None = None) -> ChainTransfer:
    legs = [l for l in legs if l.amount > 0]
    t = ChainTransfer(kind=kind, legs_json=legs_json(legs), ref_type=ref_type, ref_id=ref_id,
                      meta_json=json.dumps(meta or {}), org_id=org_id)
    if not legs:
        t.status = "CONFIRMED"
    s.add(t)
    s.flush()
    return t


def _meta(t: ChainTransfer) -> dict:
    return json.loads(t.meta_json or "{}")


def _confirmed(s: Session, t: ChainTransfer) -> None:
    t.status, t.confirmed_at = "CONFIRMED", now()
    s.add(t)
    if t.kind in PUBLIC_KINDS:
        m = _meta(t)
        ledger.append(s, clock.today(s), "TransferConfirmed",
                      {"transfer_id": t.id, "kind": t.kind, "signature": t.signature,
                       **{k: v for k, v in m.items() if k in ("pool_id", "loan_id")}})


def process(s: Session, chain: ChainService, limit: int = 10) -> int:
    """Send pending transfers and confirm sent ones. Returns the number of state changes.

    The signature and expiry height are committed *before* sending, so a lost
    response is resolved by looking the signature up rather than paying twice.
    """
    changed = 0
    for t in s.exec(select(ChainTransfer).where(ChainTransfer.status == "SENT").order_by(col(ChainTransfer.id)).limit(limit)):
        st = chain.client.status(t.signature)
        if st is None:
            if t.last_valid_height is not None and chain.client.block_height() > t.last_valid_height:
                t.status, t.signature, t.last_error = "PENDING", None, "expired before landing; resending"
                s.add(t)
                changed += 1
            continue
        if st.err:
            t.attempts += 1
            t.last_error = f"failed on-chain: {st.err}"
            t.status, t.signature = ("FAILED", t.signature) if t.attempts >= MAX_ATTEMPTS else ("PENDING", None)
            s.add(t)
        elif st.confirmed:
            _confirmed(s, t)
        changed += 1
    s.commit()
    for t in s.exec(select(ChainTransfer).where(ChainTransfer.status == "PENDING").order_by(col(ChainTransfer.id)).limit(limit)):
        try:
            tx, last_valid = chain.build(legs_from_json(t.legs_json))
        except ChainError as e:  # RPC unreachable: try again on the next run, no attempt burned
            t.last_error = str(e)[:400]
            s.add(t)
            s.commit()
            continue
        t.signature, t.last_valid_height, t.status = str(tx.signatures[0]), last_valid, "SENT"
        s.add(t)
        s.commit()
        try:
            chain.client.send(tx)
        except ChainError as e:  # it may still have landed; the SENT pass decides
            t.last_error = str(e)[:400]
        st = chain.client.status(t.signature)
        if st and st.confirmed and not st.err:
            _confirmed(s, t)
        s.add(t)
        s.commit()
        changed += 1
    return changed


def explorer(chain: ChainService, t: ChainTransfer) -> str | None:
    from credent.chain.client import explorer_tx

    return explorer_tx(t.signature, chain.cluster) if t.signature else None
