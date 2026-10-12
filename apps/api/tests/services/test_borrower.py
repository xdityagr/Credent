import base64
from dataclasses import replace

import base58
import pytest
from nacl.signing import SigningKey
from sqlmodel import select

from credent.core.pool import Pool, deposit
from credent.errors import (
    ActiveLoanExists,
    CreditExceeded,
    InsufficientLiquidity,
    ProofMismatch,
    StepOutOfOrder,
    ThresholdNotMet,
    Unauthorized,
)
from credent.models import AttestationRow, LedgerEvent, LoanRow
from credent.services import auth, borrower, pool_store
from credent.terms import CREDIT_ADVANCE_BPS

WALLET = base58.b58encode(bytes(SigningKey(b"\x01" * 32).verify_key)).decode()


def fund(session, junior=500_000_00, senior=2_000_000_00):
    p, _ = deposit(Pool(), "junior", junior)
    if senior:
        p, _ = deposit(p, "senior", senior)
    pool_store.save(session, p)
    session.commit()


def onboard(session, ctx, profile="saas"):
    view = borrower.connect_stripe(session, WALLET, profile)
    borrower.attest(session, ctx, WALLET)
    proof = borrower.prove(session, ctx, WALLET, view["suggested_threshold"])
    line = borrower.open_credit_line(session, WALLET)
    session.commit()
    return view, proof, line


def ledger_types(session):
    return [e.type for e in session.exec(select(LedgerEvent).order_by(LedgerEvent.seq))]


def test_happy_path(session, ctx):
    fund(session)
    view, proof, line = onboard(session, ctx)
    assert view["total"] == sum(view["daily"]) and len(view["daily"]) == 90
    assert view["suggested_threshold"] <= view["total"]
    assert proof.threshold == view["suggested_threshold"]
    assert line.limit == proof.threshold * CREDIT_ADVANCE_BPS // 10_000
    loan = borrower.draw(session, WALLET, line.limit)
    session.commit()
    assert loan.principal == line.limit
    assert pool_store.load(session).outstanding == line.limit
    assert ledger_types(session) == ["AttestationRecorded", "ProofVerified", "CreditLineOpened", "LoanDrawn"]


def test_public_ledger_never_contains_revenue(session, ctx):
    fund(session)
    view, _, _ = onboard(session, ctx)
    blob = " ".join(e.payload_json for e in session.exec(select(LedgerEvent)))
    assert str(view["total"]) not in blob
    assert all(str(v) not in blob for v in view["daily"] if v > 1000)


def test_steps_must_be_in_order(session, ctx):
    with pytest.raises(StepOutOfOrder):
        borrower.attest(session, ctx, WALLET)
    borrower.connect_stripe(session, WALLET, "saas")
    with pytest.raises(StepOutOfOrder):
        borrower.prove(session, ctx, WALLET, 1)
    with pytest.raises(StepOutOfOrder):
        borrower.open_credit_line(session, WALLET)


def test_threshold_above_revenue_is_rejected(session, ctx):
    view = borrower.connect_stripe(session, WALLET, "saas")
    borrower.attest(session, ctx, WALLET)
    with pytest.raises(ThresholdNotMet):
        borrower.prove(session, ctx, WALLET, view["total"] + 1)


def test_proof_for_other_commitment_is_rejected(session, ctx):
    borrower.connect_stripe(session, WALLET, "saas")
    att = borrower.attest(session, ctx, WALLET)
    art = ctx.prover.prove([1000] * 90, "999", 1000)  # valid proof, wrong commitment
    with pytest.raises(ProofMismatch):
        borrower.check_proof(att, art, 1000, ctx.prover)
    other = replace(art)
    with pytest.raises(ProofMismatch):
        borrower.check_proof(att, other, 999, ctx.prover)  # threshold differs from claimed


def test_draw_over_limit_rejected_without_side_effects(session, ctx):
    fund(session)
    _, _, line = onboard(session, ctx)
    before = pool_store.load(session)
    with pytest.raises(CreditExceeded):
        borrower.draw(session, WALLET, line.limit + 1)
    assert pool_store.load(session) == before
    assert session.exec(select(LoanRow)).first() is None


def test_draw_over_liquidity_rejected(session, ctx):
    fund(session, junior=1_000_00, senior=0)
    _, _, line = onboard(session, ctx)
    with pytest.raises(InsufficientLiquidity):
        borrower.draw(session, WALLET, min(line.limit, 1_000_01))
    assert session.exec(select(LoanRow)).first() is None


def test_second_active_loan_rejected(session, ctx):
    fund(session)
    _, _, line = onboard(session, ctx)
    borrower.draw(session, WALLET, line.limit // 2)
    with pytest.raises(ActiveLoanExists):
        borrower.draw(session, WALLET, 100_00)


def test_receipts_path(session, ctx):
    rows = borrower.sample_receipts(session, ctx, WALLET, "ecommerce", tampered=False)
    view = borrower.connect_receipts(session, ctx, WALLET, "ecommerce", rows)
    assert view["source"] == "receipts" and view["total"] > 0
    att = borrower.attest(session, ctx, WALLET)
    assert session.get(AttestationRow, att.id).source == "receipts"


def test_auth_challenge_roundtrip(session):
    key = SigningKey(b"\x02" * 32)
    wallet = base58.b58encode(bytes(key.verify_key)).decode()
    msg = auth.challenge(session, wallet)
    sig = base58.b58encode(key.sign(msg.encode()).signature).decode()
    token = auth.verify(session, wallet, sig)
    assert auth.wallet_for(session, token) == wallet
    msg2 = auth.challenge(session, wallet)
    bad = base58.b58encode(SigningKey(b"\x03" * 32).sign(msg2.encode()).signature).decode()
    with pytest.raises(Unauthorized):
        auth.verify(session, wallet, bad)


def test_demo_wallet(session):
    wallet, token = auth.demo(session)
    assert auth.wallet_for(session, token) == wallet
    assert len(base58.b58decode(wallet)) == 32
    assert base64  # silence unused import linters
