"""Regression tests for findings from the final whole-branch review."""

import hashlib
import json

import httpx
import pytest
from sqlmodel import Session, select

from credent import ledger
from credent.anchor import SolanaAnchor, anchor_pending
from credent.config import Settings
from credent.crypto.keys import KeyStore
from credent.errors import BorrowerInDefault, StepOutOfOrder
from credent.models import AttestationRow, Block, Borrower, CreditLine, LedgerEvent, LoanRow, ProofRow
from credent.services import borrower, pool_store, public, sim
from tests.services.test_borrower import WALLET, fund, onboard


# C1: public data must not determine the private revenue series.
def test_seed_and_account_hash_not_derivable_from_public_data(session, ctx):
    view = borrower.connect_stripe(session, WALLET, "saas")
    att = borrower.attest(session, ctx, WALLET)
    b = borrower.get(session, WALLET)
    digest = hashlib.sha256(WALLET.encode()).hexdigest()
    assert b.seed != int(digest[:8], 16)
    # The reviewer's attack: brute-force the seed from the pseudonym prefix against account_hash.
    prefix = int(b.id[4:], 16) if b.id[4:].isalnum() else 0
    candidates = [(prefix << 8) | low for low in range(256)]
    for cand in candidates:
        guess = hashlib.sha256(f"credent-account:acct_{cand:08x}".encode()).hexdigest()
        assert guess != att.account_hash
    assert view["total"] > 0


# I1: forced default must deliver this week's swept cash to the pool before writing off.
def test_force_default_delivers_swept_cash(engine, ctx):
    sim.reset(engine, ctx, warmup_days=0)
    with Session(engine) as s:
        loan = s.exec(select(LoanRow).order_by(LoanRow.id)).first()
        due = borrower.loan_state(loan).due()
        sim.payment(s, loan.borrower_id, due)
        before = pool_store.load(s)
        outstanding = borrower.loan_state(s.get(LoanRow, loan.id)).outstanding
        sim.force_default(s, loan.id)
        after = pool_store.load(s)
        sched = borrower.loan_state(s.get(LoanRow, loan.id)).schedule[0]
        loss = json.loads(s.exec(select(LedgerEvent).where(LedgerEvent.type == "LossAllocated")).one().payload_json)
        assert loss["loss"] == outstanding - sched.principal
        fee = sched.interest * 1000 // 10_000
        assert after.cash == before.cash + due - fee
        assert after.treasury == before.treasury + fee
        after.check()


# I2: a borrower with a defaulted loan cannot draw again, and a line is single-use.
def test_defaulted_borrower_cannot_redraw(session, ctx):
    fund(session)
    _, _, line = onboard(session, ctx)
    loan = borrower.draw(session, WALLET, line.limit // 2)
    session.commit()
    sim.force_default(session, loan.id)
    with pytest.raises(BorrowerInDefault):
        borrower.draw(session, WALLET, 100_00)
    with pytest.raises(BorrowerInDefault):
        borrower.open_credit_line(session, WALLET)


def test_credit_line_is_single_use(session, ctx):
    fund(session)
    _, _, line = onboard(session, ctx)
    loan = borrower.draw(session, WALLET, line.limit // 2)
    st = borrower.loan_state(loan)
    st.status = "REPAID"
    loan.status = "REPAID"
    loan.state_json = json.dumps(st.to_dict())
    session.add(loan)
    session.commit()
    with pytest.raises(StepOutOfOrder):
        borrower.draw(session, WALLET, 100_00)


# I3: "latest" must mean most recently created, even within the same sim day.
def test_reattest_after_reconnect_uses_newest_attestation(session, ctx):
    borrower.connect_stripe(session, WALLET, "saas")
    borrower.attest(session, ctx, WALLET)
    view = borrower.connect_stripe(session, WALLET, "ecommerce")
    borrower.attest(session, ctx, WALLET)
    proof = borrower.prove(session, ctx, WALLET, view["suggested_threshold"])  # must not PROOF_MISMATCH
    assert proof.threshold == view["suggested_threshold"]


def test_credit_line_uses_newest_proof(session, ctx):
    view = borrower.connect_stripe(session, WALLET, "saas")
    borrower.attest(session, ctx, WALLET)
    borrower.prove(session, ctx, WALLET, 100_00)
    second = borrower.prove(session, ctx, WALLET, view["suggested_threshold"])
    line = borrower.open_credit_line(session, WALLET)
    assert line.proof_id == second.id


# I4: the anchor worker must not stamp a signature onto a block that changed underneath it.
def test_anchor_does_not_overwrite_replaced_block(tmp_path, engine):
    with Session(engine) as s:
        ledger.append(s, 90, "X", {})
        ledger.seal_block(s, 91)
        s.commit()

    class Racing(SolanaAnchor):
        def anchor(self, b):
            with Session(engine) as other:  # a world reset replaces block 1 mid-RPC
                blk = other.get(Block, 1)
                blk.merkle_root = "e" * 64
                other.add(blk)
                other.commit()
            return "ANCHORED", "oldsig", None

    settings = Settings(data_dir=tmp_path, anchor_enabled=True)
    a = Racing(settings, KeyStore(tmp_path), http=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500))))
    with Session(engine) as s:
        anchor_pending(s, a)
    with Session(engine) as s:
        b = s.get(Block, 1)
        assert b.anchor_sig is None and b.anchor_status == "PENDING"


# I5: public verification must pin the notary key and the circuit's verification key.
def test_verify_rejects_foreign_notary_key(session, ctx):
    fund(session)
    _, proof, _ = onboard(session, ctx)
    att = session.get(AttestationRow, proof.attestation_id)
    att.notary_pubkey = "11111111111111111111111111111111"
    session.add(att)
    session.commit()
    out = public.verify_proof(session, proof.id, ctx.prover, ctx.keys)
    assert out.notary_trusted is False and out.valid is False


def test_verify_rejects_swapped_vk(session, ctx):
    fund(session)
    _, proof, _ = onboard(session, ctx)
    row = session.get(ProofRow, proof.id)
    row.vk_b64 = "c3dhcHBlZA=="
    session.add(row)
    session.commit()
    out = public.verify_proof(session, proof.id, ctx.prover, ctx.keys)
    assert out.vk_pinned is False and out.valid is False


def test_verify_happy_path_pins_everything(session, ctx):
    fund(session)
    _, proof, _ = onboard(session, ctx)
    out = public.verify_proof(session, proof.id, ctx.prover, ctx.keys)
    assert out.valid and out.notary_trusted and out.vk_pinned


def test_unused_imports_guard():
    assert Borrower and CreditLine
