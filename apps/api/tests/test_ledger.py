import pytest
from sqlmodel import Session, select

from credent import ledger
from credent.crypto.merkle import merkle_root
from credent.db import init_db, make_engine
from credent.models import Block, LedgerEvent


@pytest.fixture
def session():
    engine = make_engine("sqlite://")
    init_db(engine)
    with Session(engine) as s:
        yield s


def test_events_chain(session):
    a = ledger.append(session, 90, "Deposit", {"amount": 1})
    b = ledger.append(session, 90, "Deposit", {"amount": 2})
    session.commit()
    assert (a.seq, b.seq) == (1, 2)
    assert a.prev_hash == "0" * 64
    assert b.prev_hash == a.hash
    assert ledger.verify_chain(session) == (True, None)


def test_seal_block(session):
    assert ledger.seal_block(session, 90) is None
    evs = [ledger.append(session, 90, "X", {"i": i}) for i in range(3)]
    blk = ledger.seal_block(session, 97)
    session.commit()
    assert blk.n == 1 and (blk.first_seq, blk.last_seq) == (1, 3)
    assert blk.merkle_root == merkle_root([e.hash for e in evs])
    assert all(e.block == 1 for e in evs)
    assert ledger.seal_block(session, 97) is None
    ledger.append(session, 98, "X", {"i": 9})
    assert ledger.seal_block(session, 104).n == 2


def test_tampered_payload_detected(session):
    for i in range(5):
        ledger.append(session, 90, "X", {"i": i})
    session.commit()
    row = session.exec(select(LedgerEvent).where(LedgerEvent.seq == 3)).one()
    row.payload_json = '{"i":999}'
    session.add(row)
    session.commit()
    assert ledger.verify_chain(session) == (False, 3)


def test_tampered_block_root_detected(session):
    for i in range(3):
        ledger.append(session, 90, "X", {"i": i})
    blk = ledger.seal_block(session, 97)
    session.commit()
    blk.merkle_root = "f" * 64
    session.add(blk)
    session.commit()
    assert ledger.verify_chain(session) == (False, 1)


def test_appended_events_are_queued_for_publication(session):
    ledger.append(session, 90, "Deposit", {"amount": 1})
    assert [e["type"] for e in session.info["published"]] == ["Deposit"]
