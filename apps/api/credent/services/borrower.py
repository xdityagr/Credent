"""Borrower onboarding: revenue source -> notarized commitment -> ZK proof -> credit line -> drawdown.

Raw revenue lives only in `PrivateSeries` and `PrivatePayment`. Everything
written to the ledger is built from public fields.
"""

import base64
import hashlib
import json

from sqlmodel import Session, col, select

from credent import ledger
from credent.core import pool as poolcore
from credent.core.sweep import LoanStatus, LoanState, new_loan
from credent.crypto.keys import pubkey_b58
from credent.errors import (
    ActiveLoanExists,
    CreditExceeded,
    InvalidAmount,
    NotFound,
    ProofInvalid,
    ProofMismatch,
    StepOutOfOrder,
)
from credent.models import (
    AttestationRow,
    Borrower,
    CreditLine,
    LoanRow,
    PrivatePayment,
    PrivateSeries,
    ProofRow,
)
from credent.notary import Attestation, attest as notary_attest, verify_attestation
from credent.services import clock, pool_store
from credent.services.context import Ctx
from credent.sources.profiles import PROFILES, daily_revenue
from credent.sources.receipts import make_receipts, parse_receipts
from credent.terms import CREDIT_ADVANCE_BPS, HISTORY_DAYS, LOAN_APR_BPS, LOAN_EPOCHS, THRESHOLD_STEP
from credent.zk.encode import parse_public_inputs
from credent.zk.prover import ProofArtifacts, Prover, new_salt

ACTIVE = (LoanStatus.ACTIVE, LoanStatus.LATE)
DISTRESS_AFTER_DAYS = 21  # the distressed demo profile's revenue collapses 3 weeks after drawdown


def _h(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def get(s: Session, wallet: str) -> Borrower | None:
    return s.exec(select(Borrower).where(Borrower.wallet == wallet)).first()


def _require(s: Session, wallet: str) -> Borrower:
    b = get(s, wallet)
    if b is None:
        raise StepOutOfOrder("Connect a revenue source first.")
    return b


def _upsert_borrower(s: Session, wallet: str, profile: str) -> Borrower:
    if profile not in PROFILES:
        raise InvalidAmount(f"Unknown business profile '{profile}'.")
    b = get(s, wallet)
    if b is None:
        digest = _h(wallet)
        b = Borrower(id=f"BRW-{digest[:6].upper()}", wallet=wallet, profile=profile, seed=int(digest[:8], 16))
    elif s.get(CreditLine, b.id):
        raise StepOutOfOrder("This borrower already has a credit line.")
    b.profile = profile
    s.add(b)
    s.flush()
    return b


def _period(s: Session) -> tuple[int, int]:
    end = clock.today(s)
    return end - HISTORY_DAYS, end


def _suggest(total: int) -> int:
    return max(THRESHOLD_STEP, total // THRESHOLD_STEP * THRESHOLD_STEP) if total >= THRESHOLD_STEP else total


def _store_series(s: Session, b: Borrower, source: str, account_ref: str, daily: list[int]) -> dict:
    start, end = _period(s)
    row = s.get(PrivateSeries, b.id) or PrivateSeries(borrower_id=b.id, source=source, account_ref="",
                                                      daily_json="[]", salt="0", total=0,
                                                      period_start=start, period_end=end)
    row.source, row.account_ref = source, account_ref
    row.daily_json, row.salt, row.total = json.dumps(daily), new_salt(), sum(daily)
    row.period_start, row.period_end = start, end
    s.add(row)
    s.flush()
    return series_view(row)


def series_view(row: PrivateSeries) -> dict:
    return {
        "source": row.source,
        "period_start": row.period_start,
        "period_end": row.period_end,
        "daily": json.loads(row.daily_json),
        "total": row.total,
        "suggested_threshold": _suggest(row.total),
    }


def connect_stripe(s: Session, wallet: str, profile: str) -> dict:
    b = _upsert_borrower(s, wallet, profile)
    start, _ = _period(s)
    daily = daily_revenue(PROFILES[profile], b.seed, start, HISTORY_DAYS)
    return _store_series(s, b, "stripe-zktls-sim", f"acct_{b.seed:08x}", daily)


def sample_receipts(s: Session, ctx: Ctx, wallet: str, profile: str, tampered: bool) -> list[dict]:
    if profile not in PROFILES:
        raise InvalidAmount(f"Unknown business profile '{profile}'.")
    seed = int(_h(wallet)[:8], 16)
    start, _ = _period(s)
    series = daily_revenue(PROFILES[profile], seed, start, HISTORY_DAYS)
    return make_receipts(series, start, ctx.keys.get("processor"), tampered=tampered)


def processor_pubkey(ctx: Ctx) -> str:
    return pubkey_b58(ctx.keys.get("processor"))


def connect_receipts(s: Session, ctx: Ctx, wallet: str, profile: str, rows: list[dict]) -> dict:
    start, _ = _period(s)
    daily = parse_receipts(rows, processor_pubkey(ctx), start, HISTORY_DAYS)  # validate before any write
    b = _upsert_borrower(s, wallet, profile)
    account_ref = "receipts:" + _h(",".join(sorted(str(r["id"]) for r in rows)))
    return _store_series(s, b, "receipts", account_ref, daily)


def _series(s: Session, b: Borrower) -> PrivateSeries:
    row = s.get(PrivateSeries, b.id)
    if row is None:
        raise StepOutOfOrder("Connect a revenue source first.")
    return row


def _latest(s: Session, model, b: Borrower):
    return s.exec(select(model).where(model.borrower_id == b.id).order_by(col(model.day).desc())).first()


def attest(s: Session, ctx: Ctx, wallet: str) -> AttestationRow:
    b = _require(s, wallet)
    series = _series(s, b)
    commitment = ctx.prover.commit(json.loads(series.daily_json), series.salt)
    a = notary_attest(series.source, series.period_start, series.period_end, series.account_ref,
                      commitment, ctx.keys.get("notary"))
    row = AttestationRow(**a.__dict__, borrower_id=b.id, day=clock.today(s))
    s.merge(row)
    ledger.append(s, row.day, "AttestationRecorded", {
        "attestation_id": a.id, "borrower": b.id, "source": a.source,
        "period_start": a.period_start, "period_end": a.period_end,
        "account_hash": a.account_hash, "commitment": a.commitment,
        "notary_pubkey": a.notary_pubkey, "signature": a.signature,
    })
    return row


def to_attestation(row: AttestationRow) -> Attestation:
    return Attestation(id=row.id, source=row.source, period_start=row.period_start,
                       period_end=row.period_end, account_hash=row.account_hash,
                       commitment=row.commitment, notary_pubkey=row.notary_pubkey,
                       signature=row.signature)


def check_proof(att: AttestationRow, art: ProofArtifacts, threshold: int, prover: Prover) -> None:
    """Underwriting check: proof verifies AND is bound to this attestation and threshold."""
    if not verify_attestation(to_attestation(att)):
        raise ProofInvalid("Notary signature on the attestation is invalid.")
    if not prover.verify(art):
        raise ProofInvalid("The zero-knowledge proof did not verify.")
    pi_threshold, pi_commitment = parse_public_inputs(base64.b64decode(art.public_inputs_b64))
    if pi_threshold != threshold:
        raise ProofMismatch("Proof threshold differs from the claimed threshold.")
    if pi_commitment != att.commitment:
        raise ProofMismatch("Proof commitment differs from the notarized commitment.")


def prove(s: Session, ctx: Ctx, wallet: str, threshold: int) -> ProofRow:
    if not isinstance(threshold, int) or threshold <= 0:
        raise InvalidAmount("Threshold must be a positive number of cents.")
    b = _require(s, wallet)
    att = _latest(s, AttestationRow, b)
    if att is None:
        raise StepOutOfOrder("Notarize your revenue first.")
    series = _series(s, b)
    art = ctx.prover.prove(json.loads(series.daily_json), series.salt, threshold)
    check_proof(att, art, threshold, ctx.prover)
    row = ProofRow(
        id="prf_" + _h(art.proof_b64)[:16], borrower_id=b.id, attestation_id=att.id,
        threshold=threshold, commitment=att.commitment, proof_b64=art.proof_b64,
        public_inputs_b64=art.public_inputs_b64, vk_b64=art.vk_b64, verified=True,
        timings_json=json.dumps(art.timings_ms), day=clock.today(s),
    )
    s.merge(row)
    ledger.append(s, row.day, "ProofVerified", {
        "proof_id": row.id, "borrower": b.id, "attestation_id": att.id,
        "claim": "sum(daily_revenue[90d]) >= threshold", "threshold": threshold,
        "commitment": att.commitment, "vk_hash": _h(art.vk_b64),
    })
    return row


def open_credit_line(s: Session, wallet: str) -> CreditLine:
    b = _require(s, wallet)
    proof = _latest(s, ProofRow, b)
    if proof is None or not proof.verified:
        raise StepOutOfOrder("Generate a revenue proof first.")
    line = s.get(CreditLine, b.id) or CreditLine(borrower_id=b.id, limit=0, proof_id=proof.id, opened_day=0)
    line.limit = proof.threshold * CREDIT_ADVANCE_BPS // 10_000
    line.proof_id, line.opened_day = proof.id, clock.today(s)
    s.add(line)
    ledger.append(s, line.opened_day, "CreditLineOpened", {
        "borrower": b.id, "limit": line.limit, "proof_id": proof.id,
        "threshold": proof.threshold, "advance_bps": CREDIT_ADVANCE_BPS,
    })
    return line


def active_loan(s: Session, b: Borrower) -> LoanRow | None:
    return s.exec(select(LoanRow).where(LoanRow.borrower_id == b.id,
                                        col(LoanRow.status).in_([str(x) for x in ACTIVE]))).first()


def draw(s: Session, wallet: str, amount: int) -> LoanRow:
    b = _require(s, wallet)
    line = s.get(CreditLine, b.id)
    if line is None:
        raise StepOutOfOrder("Open a credit line first.")
    if not isinstance(amount, int) or amount <= 0:
        raise InvalidAmount()
    if active_loan(s, b):
        raise ActiveLoanExists()
    if amount > line.limit:
        raise CreditExceeded(f"Credit line is {line.limit} cents; requested {amount}.")
    pool = poolcore.draw(pool_store.load(s), amount)  # raises InsufficientLiquidity

    day = clock.today(s)
    state = new_loan(amount, LOAN_APR_BPS, LOAN_EPOCHS)
    n = s.exec(select(LoanRow)).all()
    loan = LoanRow(
        id=f"LN-{len(n) + 1:04d}", borrower_id=b.id, principal=amount, apr_bps=LOAN_APR_BPS,
        epochs=LOAN_EPOCHS, installment=state.schedule[0].total,
        state_json=json.dumps(state.to_dict()), status=str(state.status), drawn_day=day,
    )
    s.add(loan)
    if b.profile == "distressed":
        b.collapse_day = day + DISTRESS_AFTER_DAYS
        s.add(b)
    pool_store.save(s, pool)
    ledger.append(s, day, "LoanDrawn", {
        "loan_id": loan.id, "borrower": b.id, "principal": amount, "apr_bps": LOAN_APR_BPS,
        "epochs": LOAN_EPOCHS, "installment": loan.installment, "proof_id": line.proof_id,
    })
    return loan


def loan_state(loan: LoanRow) -> LoanState:
    return LoanState.from_dict(json.loads(loan.state_json))


def private_view(s: Session, wallet: str) -> dict:
    """Everything the borrower may see about themselves. Never served publicly."""
    b = get(s, wallet)
    if b is None:
        return {"borrower": None}
    series = s.get(PrivateSeries, b.id)
    att = _latest(s, AttestationRow, b)
    proof = _latest(s, ProofRow, b)
    line = s.get(CreditLine, b.id)
    loans = s.exec(select(LoanRow).where(LoanRow.borrower_id == b.id).order_by(col(LoanRow.drawn_day).desc())).all()
    loan = loans[0] if loans else None
    payments = s.exec(select(PrivatePayment).where(PrivatePayment.borrower_id == b.id)
                      .order_by(col(PrivatePayment.id).desc()).limit(80)).all()
    totals = {"swept": 0, "released": 0}
    if loan:
        for p in s.exec(select(PrivatePayment).where(PrivatePayment.loan_id == loan.id)):
            totals["swept"] += p.swept
            totals["released"] += p.released
    state = loan_state(loan) if loan else None
    profile = PROFILES[b.profile]
    return {
        "borrower": {"id": b.id, "wallet": b.wallet, "profile": b.profile,
                     "business": profile.label, "description": profile.description},
        "series": series_view(series) if series else None,
        "attestation": att.model_dump() if att else None,
        "proof": ({**proof.model_dump(exclude={"proof_b64", "vk_b64", "public_inputs_b64", "timings_json"}),
                   "timings_ms": json.loads(proof.timings_json)} if proof else None),
        "credit_line": line.model_dump() if line else None,
        "loan": ({**loan.model_dump(exclude={"state_json"}), "due_now": state.due(), "state": state.to_dict()}
                 if loan else None),
        "payments": [p.model_dump() for p in payments],
        "totals": totals,
    }


def require_loan(s: Session, loan_id: str) -> LoanRow:
    loan = s.get(LoanRow, loan_id)
    if loan is None:
        raise NotFound(f"Loan {loan_id} not found.")
    return loan
