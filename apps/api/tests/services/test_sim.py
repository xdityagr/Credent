import json

import pytest
from sqlmodel import Session, select

from credent import ledger
from credent.core.sweep import LoanStatus
from credent.errors import InsufficientBalance, NotFound, SubordinationBreach
from credent.models import Borrower, LedgerEvent, LoanRow, NavSnapshot, PrivatePayment
from credent.services import borrower, lender, pool_store, sim


@pytest.fixture
def seeded(engine, ctx):
    sim.reset(engine, ctx, warmup_days=0)
    with Session(engine) as s:
        yield s


def loans_by_profile(s):
    out = {}
    for loan in s.exec(select(LoanRow)):
        b = s.get(Borrower, loan.borrower_id)
        out[b.profile] = loan
    return out


def test_reset_seeds_pool_and_three_loans(seeded):
    p = pool_store.load(seeded)
    assert p.junior.nav == 400_000_00 and p.senior.nav == 1_400_000_00
    loans = loans_by_profile(seeded)
    assert set(loans) == {"saas", "ecommerce", "distressed"}
    assert p.outstanding == sum(l.principal for l in loans.values())
    types = [e.type for e in seeded.exec(select(LedgerEvent).order_by(LedgerEvent.seq))]
    assert types[0] == "PoolCreated"
    assert types.count("ProofVerified") == 3 and types.count("LoanDrawn") == 3


def test_eight_weeks_healthy_vs_distressed(seeded):
    for _ in range(56):
        sim.advance(seeded, 1)
        pool_store.load(seeded).check()
    loans = loans_by_profile(seeded)
    saas = borrower.loan_state(loans["saas"])
    assert loans["saas"].status == LoanStatus.ACTIVE
    assert saas.arrears_interest == saas.arrears_principal == 0
    assert loans["distressed"].status == LoanStatus.DEFAULTED
    p = pool_store.load(seeded)
    assert p.junior.writedown > 0 and p.senior.writedown == 0
    assert ledger.verify_chain(seeded) == (True, None)
    types = {e.type for e in seeded.exec(select(LedgerEvent))}
    assert {"InstallmentPaid", "InstallmentShort", "InterestDistributed", "LoanDefaulted",
            "LossAllocated"} <= types
    assert seeded.exec(select(NavSnapshot)).first() is not None


def test_payments_are_swept_then_released(seeded):
    sim.advance(seeded, 3)
    pays = seeded.exec(select(PrivatePayment)).all()
    assert pays and all(p.swept + p.released == p.amount for p in pays)
    assert any(p.swept > 0 for p in pays)


def test_advance_on_empty_pool_is_safe(engine, ctx):
    with Session(engine) as s:
        sim.advance(s, 14)
        pool_store.load(s).check()
        assert ledger.verify_chain(s) == (True, None)


def test_force_default_and_recover_senior_first(seeded):
    loan = loans_by_profile(seeded)["ecommerce"]
    sim.force_default(seeded, loan.id)
    p = pool_store.load(seeded)
    loss = loan.principal
    assert p.junior.writedown == min(loss, 400_000_00)
    sim.recover(seeded, loan.id, 50_000_00)
    events = [json.loads(e.payload_json) for e in seeded.exec(select(LedgerEvent).where(LedgerEvent.type == "RecoveryAllocated"))]
    assert events[-1]["amount"] == 50_000_00
    pool_store.load(seeded).check()


def test_force_default_unknown_loan(seeded):
    with pytest.raises(NotFound):
        sim.force_default(seeded, "LN-9999")


def test_inject_payment_routes_through_sweep(seeded):
    loan = loans_by_profile(seeded)["saas"]
    due = borrower.loan_state(loan).due()
    pay = sim.payment(seeded, loan.borrower_id, due + 1_000)
    assert (pay.swept, pay.released) == (due, 1_000)


def test_lender_deposit_and_positions(seeded):
    w = "LenderWallet111111111111111111111111111111"
    with pytest.raises(InsufficientBalance):
        lender.deposit(seeded, w, "junior", 1_000_00)
    lender.faucet(seeded, w)
    lender.deposit(seeded, w, "junior", 10_000_00)
    pos = lender.positions(seeded, w)
    assert pos["positions"][0]["tranche"] == "junior"
    assert pos["positions"][0]["value"] == 10_000_00
    with pytest.raises(SubordinationBreach):
        lender.faucet(seeded, w, 10_000_000_00)
        lender.deposit(seeded, w, "senior", 10_000_000_00)
