"""Read models for /public routes. Built only from public fields, never from Private* tables."""

import base64
import json
import time

from sqlmodel import Session, col, func, select

from credent import ledger
from credent.anchor import SolanaAnchor, memo_text
from credent.api import schemas as S
from credent.core import pool as poolcore
from credent.core.sweep import LoanStatus
from credent.errors import NotFound
from credent.models import AttestationRow, Block, CreditLine, LedgerEvent, LoanRow, NavSnapshot, ProofRow
from credent.services import borrower as borrowers
from credent.services import clock, lender, pool_store
from credent.zk.encode import parse_public_inputs
from credent.zk.prover import ProofArtifacts, Prover

CLAIM = "sum(daily_revenue[90d]) >= threshold"


def _sum_payload(s: Session, type_: str, key: str) -> int:
    total = 0
    for e in s.exec(select(LedgerEvent.payload_json).where(LedgerEvent.type == type_)):
        total += json.loads(e).get(key, 0)
    return total


def _tranche(t: poolcore.Tranche, coupon: int | None, position: str) -> S.PublicTranche:
    return S.PublicTranche(name=t.name, nav=t.nav, shares=t.shares, price_e6=lender.price_e6(t),
                           coupon_bps=coupon, coupon_arrears=t.coupon_arrears, writedown=t.writedown,
                           loss_position=position)


def pool(s: Session) -> S.PublicPool:
    p = pool_store.load(s)
    counts = dict(s.exec(select(LoanRow.status, func.count()).group_by(LoanRow.status)).all())
    return S.PublicPool(
        name="Credent Revenue Pool I",
        day=clock.today(s),
        cash=p.cash, outstanding=p.outstanding, treasury=p.treasury, total_nav=p.total_nav,
        utilization_bps=p.outstanding * 10_000 // p.total_nav if p.total_nav else 0,
        leverage_x100=p.senior.nav * 100 // p.junior.nav if p.junior.nav else 0,
        subordination_room=max(0, poolcore.MAX_LEVERAGE * p.junior.nav - p.senior.nav),
        senior=_tranche(p.senior, poolcore.SENIOR_COUPON_BPS, "last loss · paid first"),
        junior=_tranche(p.junior, None, "first loss · residual yield"),
        loans_active=counts.get(LoanStatus.ACTIVE, 0), loans_late=counts.get(LoanStatus.LATE, 0),
        loans_defaulted=counts.get(LoanStatus.DEFAULTED, 0), loans_repaid=counts.get(LoanStatus.REPAID, 0),
        total_interest=_sum_payload(s, "InterestDistributed", "interest"),
        total_losses=_sum_payload(s, "LossAllocated", "loss"),
        total_recovered=_sum_payload(s, "RecoveryAllocated", "amount"),
    )


def nav_history(s: Session) -> list[S.PublicNavPoint]:
    return [S.PublicNavPoint(**n.model_dump()) for n in s.exec(select(NavSnapshot).order_by(col(NavSnapshot.day)))]


def _loan(s: Session, loan: LoanRow) -> S.PublicLoan:
    st = borrowers.loan_state(loan)
    line = s.get(CreditLine, loan.borrower_id)
    proof = s.get(ProofRow, line.proof_id) if line else None
    return S.PublicLoan(
        id=loan.id, borrower=loan.borrower_id, principal=loan.principal, apr_bps=loan.apr_bps,
        epochs=loan.epochs, installment=loan.installment, status=loan.status, drawn_day=loan.drawn_day,
        epoch=st.epoch, outstanding=st.outstanding, arrears=st.arrears_interest + st.arrears_principal,
        consecutive_short=st.consecutive_short, proof_id=proof.id if proof else None,
        threshold=proof.threshold if proof else None,
        history=[S.PublicEpoch(**h) for h in st.history],
    )


def loans(s: Session) -> list[S.PublicLoan]:
    return [_loan(s, l) for l in s.exec(select(LoanRow).order_by(col(LoanRow.id)))]


def loan_detail(s: Session, loan_id: str) -> S.PublicLoanDetail:
    loan = borrowers.require_loan(s, loan_id)
    evs = [S.PublicEvent(**ledger.to_public(e)) for e in s.exec(select(LedgerEvent).order_by(col(LedgerEvent.seq)))
           if json.loads(e.payload_json).get("loan_id") == loan_id
           or loan_id in json.loads(e.payload_json).get("loans", [])]
    return S.PublicLoanDetail(**_loan(s, loan).model_dump(), events=evs)


def events(s: Session, after: int | None, before: int | None, limit: int, type_: str | None) -> list[S.PublicEvent]:
    q = select(LedgerEvent)
    if after is not None:
        q = q.where(LedgerEvent.seq > after).order_by(col(LedgerEvent.seq))
    else:
        if before is not None:
            q = q.where(LedgerEvent.seq < before)
        q = q.order_by(col(LedgerEvent.seq).desc())
    if type_:
        q = q.where(col(LedgerEvent.type).in_(type_.split(",")))
    return [S.PublicEvent(**ledger.to_public(e)) for e in s.exec(q.limit(min(limit, 5000)))]


def blocks(s: Session, anchor: SolanaAnchor) -> list[S.PublicBlock]:
    return [S.PublicBlock(**b.model_dump(exclude={"anchor_error"}), memo=memo_text(b),
                          anchor_url=anchor.explorer_tx(b.anchor_sig) if b.anchor_sig else None)
            for b in s.exec(select(Block).order_by(col(Block.n).desc()))]


def verify_chain(s: Session) -> S.ChainVerifyOut:
    ok, bad = ledger.verify_chain(s)
    n_ev = s.exec(select(func.count()).select_from(LedgerEvent)).one()
    n_bl = s.exec(select(func.count()).select_from(Block)).one()
    return S.ChainVerifyOut(ok=ok, bad_seq=bad, events=n_ev, blocks=n_bl)


def proof(s: Session, proof_id: str) -> S.PublicProof:
    p = s.get(ProofRow, proof_id)
    if p is None:
        raise NotFound(f"Proof {proof_id} not found.")
    a = s.get(AttestationRow, p.attestation_id)
    return S.PublicProof(
        id=p.id, borrower=p.borrower_id, day=p.day, claim=CLAIM, threshold=p.threshold,
        commitment=p.commitment,
        attestation=S.PublicAttestation(**a.model_dump(exclude={"borrower_id", "day"})),
        proof_b64=p.proof_b64, public_inputs_b64=p.public_inputs_b64, vk_b64=p.vk_b64,
    )


def verify_proof(s: Session, proof_id: str, prover: Prover) -> S.ProofVerifyOut:
    """Independent re-verification of stored artifacts (runs bb verify)."""
    pp = proof(s, proof_id)
    t0 = time.perf_counter()
    proof_ok = prover.verify(ProofArtifacts(pp.proof_b64, pp.public_inputs_b64, pp.vk_b64))
    ms = int((time.perf_counter() - t0) * 1000)
    att_ok = borrowers.verify_attestation(borrowers.to_attestation(s.get(AttestationRow, pp.attestation.id)))
    th, cm = parse_public_inputs(base64.b64decode(pp.public_inputs_b64))
    t_ok, c_ok = th == pp.threshold, cm == pp.attestation.commitment
    return S.ProofVerifyOut(proof_valid=proof_ok, attestation_valid=att_ok, threshold_bound=t_ok,
                            commitment_bound=c_ok, valid=proof_ok and att_ok and t_ok and c_ok,
                            verifier="UltraHonk (bb verify)", ms=ms)
