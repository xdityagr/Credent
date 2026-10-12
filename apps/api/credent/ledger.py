"""Append-only, hash-chained public ledger with Merkle-rooted blocks.

hash = sha256(prev_hash | seq | day | type | canonical_json(payload))
Payloads must contain public data only; callers build them from public fields.
"""

import hashlib
import json

from sqlmodel import Session, col, select

from credent.crypto.canonical import canonical_json
from credent.crypto.merkle import merkle_root
from credent.models import Block, LedgerEvent

GENESIS = "0" * 64


def event_hash(prev_hash: str, seq: int, day: int, type_: str, payload_json: str) -> str:
    return hashlib.sha256(f"{prev_hash}|{seq}|{day}|{type_}|{payload_json}".encode()).hexdigest()


def _last(session: Session) -> LedgerEvent | None:
    return session.exec(select(LedgerEvent).order_by(col(LedgerEvent.seq).desc()).limit(1)).first()


def to_public(e: LedgerEvent) -> dict:
    return {
        "seq": e.seq,
        "day": e.day,
        "type": e.type,
        "payload": json.loads(e.payload_json),
        "prev_hash": e.prev_hash,
        "hash": e.hash,
        "block": e.block,
        "pool_id": e.pool_id,
    }


def append(session: Session, day: int, type_: str, payload: dict) -> LedgerEvent:
    """Add an event in the caller's transaction. Published to SSE after commit."""
    last = _last(session)
    seq = (last.seq if last else 0) + 1
    prev = last.hash if last else GENESIS
    payload_json = canonical_json(payload)
    ev = LedgerEvent(seq=seq, day=day, type=type_, payload_json=payload_json, prev_hash=prev,
                     pool_id=payload.get("pool_id"), hash=event_hash(prev, seq, day, type_, payload_json))
    session.add(ev)
    session.flush()
    session.info.setdefault("published", []).append(to_public(ev))
    return ev


def seal_block(session: Session, day: int) -> Block | None:
    events = session.exec(
        select(LedgerEvent).where(col(LedgerEvent.block).is_(None)).order_by(col(LedgerEvent.seq))
    ).all()
    if not events:
        return None
    last = session.exec(select(Block).order_by(col(Block.n).desc()).limit(1)).first()
    n = (last.n if last else 0) + 1
    for e in events:
        e.block = n
        session.add(e)
    blk = Block(n=n, first_seq=events[0].seq, last_seq=events[-1].seq,
                merkle_root=merkle_root([e.hash for e in events]), day=day)
    session.add(blk)
    session.flush()
    session.info.setdefault("published", []).append({"type": "BlockSealed", "block": n, "merkle_root": blk.merkle_root})
    return blk


def verify_chain(session: Session) -> tuple[bool, int | None]:
    """Recompute every hash link and every block root. Returns (ok, first_bad_seq)."""
    prev = GENESIS
    by_block: dict[int, list[str]] = {}
    for e in session.exec(select(LedgerEvent).order_by(col(LedgerEvent.seq))):
        if e.prev_hash != prev or e.hash != event_hash(prev, e.seq, e.day, e.type, e.payload_json):
            return False, e.seq
        if e.block is not None:
            by_block.setdefault(e.block, []).append(e.hash)
        prev = e.hash
    for b in session.exec(select(Block).order_by(col(Block.n))):
        if merkle_root(by_block.get(b.n, [])) != b.merkle_root:
            return False, b.first_seq
    return True, None
