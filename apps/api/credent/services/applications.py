"""Borrowers apply to a pool with a revenue proof; the pool manager approves; the borrower signs and draws."""

import json
import secrets

from sqlmodel import Session, col, select

from credent import ledger
from credent.auth.security import now
from credent.core.amortize import amortize
from credent.crypto.keys import verify_b58_sig
from credent.errors import (
    ActiveLoanExists,
    BorrowerInDefault,
    CreditExceeded,
    Forbidden,
    InsufficientLiquidity,
    InvalidAmount,
    NotFound,
    PoolClosed,
    StepOutOfOrder,
    Unauthorized,
)
from credent.models import Application, Organization, Pool, ProofRow
from credent.services import audit, clock, loans, notify, pools, wallets

OPEN_STATES = ("SUBMITTED", "APPROVED")


def limit_for(p: Pool, threshold: int) -> int:
    cap = threshold * p.advance_bps // 10_000
    return min(cap, p.max_loan) if p.max_loan else cap


def quote(p: Pool, amount: int) -> dict:
    sched = amortize(amount, p.borrower_apr_bps, p.term_epochs)
    return {"amount": amount, "apr_bps": p.borrower_apr_bps, "epochs": p.term_epochs,
            "installment": sched[0].total, "total_repaid": sum(i.total for i in sched),
            "total_interest": sum(i.interest for i in sched)}


def get(s: Session, app_id: str) -> Application:
    a = s.get(Application, app_id)
    if a is None:
        raise NotFound("Application not found.")
    return a


def apply(s: Session, chain, org: Organization, pool_id: str, proof_id: str, amount: int, settings=None) -> Application:
    p = pools.get(s, pool_id)
    if p.status != "OPEN":
        raise PoolClosed("This pool isn't taking applications.")
    proof = s.get(ProofRow, proof_id)
    if proof is None or proof.org_id != org.id:
        raise NotFound("Proof not found.")
    if clock.today(s) > proof.expires_day:
        raise StepOutOfOrder("This proof has expired. Generate a fresh one from current revenue.")
    if proof.threshold < p.min_threshold:
        raise CreditExceeded(f"This pool requires proven 90-day revenue of at least ${p.min_threshold / 100:,.0f}.")
    if loans.has_default(s, org.id):
        raise BorrowerInDefault()
    if loans.active_for(s, org.id):
        raise ActiveLoanExists("Repay your current loan before applying again.")
    if s.exec(select(Application).where(Application.borrower_org_id == org.id,
                                        col(Application.status).in_(OPEN_STATES))).first():
        raise ActiveLoanExists("You already have an application in progress.")
    if not isinstance(amount, int) or amount < 1_000_00:
        raise InvalidAmount("Minimum loan is $1,000.")
    cap = limit_for(p, proof.threshold)
    if amount > cap:
        raise CreditExceeded(f"Your proof supports up to ${cap / 100:,.0f} in this pool.")
    available = pools.load(p).cash
    if amount > available:
        raise InsufficientLiquidity(f"This pool has ${available / 100:,.0f} available to lend right now.")
    wallets.require_primary(s, org)
    app = Application(pool_id=p.id, borrower_org_id=org.id, proof_id=proof.id, requested=amount,
                      terms_json=json.dumps(quote(p, amount)))
    s.add(app)
    s.flush()
    audit.log(s, None, org.id, "application.submit", app.id, pool=p.id, amount=amount)
    from credent.models import RevenueSource

    src = s.get(RevenueSource, proof.source_id)
    manager = s.get(Organization, p.manager_org_id)
    trusted_source = (src is not None and src.kind == "STRIPE") or manager.is_demo
    if p.auto_approve and trusted_source and amount <= (p.auto_approve_max or cap):
        _decide(s, p, app, "APPROVED", "Approved automatically: proof meets the pool's rules.", None, auto=True)
        notify.notify(s, org.id, "application_approved", f"Approved by {p.name}",
                      "Sign the loan terms to receive your funds.", f"/app/applications?open={app.id}",
                      email=settings is not None, settings=settings)
    else:
        notify.notify(s, p.manager_org_id, "application", f"New application to {p.name}",
                      f"{org.pseudonym} requests ${amount / 100:,.0f} with proven revenue ≥ ${proof.threshold / 100:,.0f}.",
                      "/app/review", email=settings is not None, settings=settings)
    return app


def _decide(s: Session, p: Pool, app: Application, status: str, note: str, user_id: str | None, auto: bool = False):
    app.status, app.decision_note, app.decided_by, app.decided_at, app.auto = status, note[:500], user_id, now(), auto
    s.add(app)
    if status == "APPROVED":
        ledger.append(s, clock.today(s), "LoanApproved", {"pool_id": p.id, "application_id": app.id,
                                                          "borrower": s.get(Organization, app.borrower_org_id).pseudonym,
                                                          "amount": app.requested, "auto": auto})


def decide(s: Session, user, manager: Organization, app_id: str, approve: bool, note: str, settings=None) -> Application:
    app = get(s, app_id)
    p = s.get(Pool, app.pool_id)
    if p.manager_org_id != manager.id:
        raise Forbidden("Only the pool manager can decide this application.")
    if app.status != "SUBMITTED":
        raise StepOutOfOrder(f"This application is already {app.status.lower()}.")
    _decide(s, p, app, "APPROVED" if approve else "DECLINED", note, user.id)
    audit.log(s, user.id, manager.id, "application.approve" if approve else "application.decline", app.id)
    title = f"{'Approved' if approve else 'Declined'} by {p.name}"
    body = "Sign the loan terms to receive your funds." if approve else (note or "The pool manager declined this request.")
    notify.notify(s, app.borrower_org_id, "application_" + ("approved" if approve else "declined"), title, body,
                  f"/app/applications?open={app.id}", email=settings is not None, settings=settings)
    return app


def withdraw(s: Session, org: Organization, app_id: str) -> Application:
    app = get(s, app_id)
    if app.borrower_org_id != org.id:
        raise Forbidden()
    if app.status not in OPEN_STATES:
        raise StepOutOfOrder("Only open applications can be withdrawn.")
    app.status = "WITHDRAWN"
    s.add(app)
    return app


def terms_text(s: Session, org: Organization, app: Application) -> str:
    """The exact message the borrower signs; verification rebuilds it from the same data."""
    p = s.get(Pool, app.pool_id)
    q = json.loads(app.terms_json)
    return "\n".join([
        "Credent loan agreement",
        "",
        f"Borrower: {org.name} ({org.pseudonym})",
        f"Pool: {p.name}",
        f"Principal: ${q['amount'] / 100:,.2f} cUSD",
        f"APR: {q['apr_bps'] / 100:.2f}%",
        f"Repayment: {q['epochs']} weekly installments of about ${q['installment'] / 100:,.2f}",
        "Collections: incoming customer payments repay the installment due before any remainder is released.",
        "Default: 3 consecutive short weeks.",
        "",
        f"Application: {app.id}",
        f"Nonce: {app.accept_nonce}",
    ])


def terms_message(s: Session, org: Organization, app_id: str) -> str:
    app = get(s, app_id)
    if app.borrower_org_id != org.id:
        raise Forbidden()
    if app.status != "APPROVED":
        raise StepOutOfOrder("This application isn't approved.")
    app.accept_nonce = secrets.token_hex(12)
    s.add(app)
    return terms_text(s, org, app)


def accept(s: Session, chain, org: Organization, app_id: str, signature: str | None, settings=None):
    app = get(s, app_id)
    if app.borrower_org_id != org.id:
        raise Forbidden()
    if app.status != "APPROVED":
        raise StepOutOfOrder("This application isn't approved.")
    w = wallets.require_primary(s, org)
    if w.kind == "EXTERNAL":
        if not app.accept_nonce or not signature:
            raise Unauthorized("Sign the loan terms with your wallet.")
        msg = terms_text(s, org, app)
        if not verify_b58_sig(w.address, msg.encode(), signature):
            raise Unauthorized("The signature doesn't match your wallet.")
    p = s.get(Pool, app.pool_id)
    proof = s.get(ProofRow, app.proof_id)
    if p.status not in ("OPEN", "FUNDING"):
        raise PoolClosed("This pool has closed since your application was approved.")
    if clock.today(s) > proof.expires_day:
        raise StepOutOfOrder("Your proof expired. Generate a fresh one and apply again.")
    if loans.has_default(s, org.id):
        raise BorrowerInDefault()
    app.accept_signature = signature or "custodial-consent"
    loan = loans.draw(s, chain, app, settings)
    audit.log(s, None, org.id, "application.accept", app.id, loan=loan.id)
    return loan


def view(s: Session, app: Application, for_manager: bool = False) -> dict:
    p = s.get(Pool, app.pool_id)
    org = s.get(Organization, app.borrower_org_id)
    proof = s.get(ProofRow, app.proof_id)
    out = {"id": app.id, "status": app.status, "requested": app.requested, "terms": json.loads(app.terms_json),
           "decision_note": app.decision_note, "auto": app.auto, "created_at": app.created_at.isoformat(),
           "decided_at": app.decided_at.isoformat() if app.decided_at else None,
           "pool": {"id": p.id, "slug": p.slug, "name": p.name},
           "proof": {"id": proof.id, "threshold": proof.threshold, "commitment": proof.commitment,
                     "expires_date": clock.iso_date(s, proof.expires_day), "source_kind": _source_kind(s, proof)},
           "borrower": {"pseudonym": org.pseudonym}}
    if for_manager:  # the reviewing manager sees who is applying, never their revenue
        from credent.services.orgs import view as org_view

        out["borrower"] = {**org_view(org), "track_record": track_record(s, org.id)}
    return out


def _source_kind(s: Session, proof: ProofRow) -> str | None:
    from credent.models import RevenueSource

    src = s.get(RevenueSource, proof.source_id)
    return src.kind if src else None


def track_record(s: Session, org_id: str) -> dict:
    from credent.models import LoanRow

    rows = s.exec(select(LoanRow).where(LoanRow.borrower_org_id == org_id)).all()
    return {"loans": len(rows), "repaid": sum(r.status == "REPAID" for r in rows),
            "defaulted": sum(r.status == "DEFAULTED" for r in rows),
            "active": sum(r.status in ("ACTIVE", "LATE") for r in rows)}


def for_borrower(s: Session, org: Organization) -> list[Application]:
    return list(s.exec(select(Application).where(Application.borrower_org_id == org.id)
                       .order_by(col(Application.created).desc())))


def for_manager(s: Session, org: Organization, status: str | None = None) -> list[Application]:
    pool_ids = [p.id for p in pools.for_manager(s, org)]
    if not pool_ids:
        return []
    q = select(Application).where(col(Application.pool_id).in_(pool_ids))
    if status:
        q = q.where(Application.status == status)
    return list(s.exec(q.order_by(col(Application.created).desc())))
