"""Loans: drawdown from a pool vault to the borrower's wallet, and loan views."""

import json

from sqlmodel import Session, col, select

from credent import ledger
from credent.chain import spl
from credent.chain.service import ChainService, Leg
from credent.core import pool as poolcore
from credent.core.sweep import CLOSED, LoanState, LoanStatus, new_loan
from credent.errors import NotFound
from credent.models import Application, LoanRow, Organization, Pool, PrivatePayment, RevenueSource
from credent.services import clock, notify, pools, transfers, wallets

ACTIVE = (LoanStatus.ACTIVE, LoanStatus.LATE)
DISTRESS_AFTER_DAYS = 21  # the distressed demo business's revenue collapses three weeks after drawdown


def state(loan: LoanRow) -> LoanState:
    return LoanState.from_dict(json.loads(loan.state_json))


def save_state(s: Session, loan: LoanRow, st: LoanState) -> None:
    loan.state_json = json.dumps(st.to_dict())
    loan.status = str(st.status)
    s.add(loan)


def active_for(s: Session, org_id: str) -> LoanRow | None:
    return s.exec(select(LoanRow).where(LoanRow.borrower_org_id == org_id,
                                        col(LoanRow.status).in_([str(x) for x in ACTIVE]))).first()


def has_default(s: Session, org_id: str) -> bool:
    return s.exec(select(LoanRow).where(LoanRow.borrower_org_id == org_id,
                                        LoanRow.status == str(LoanStatus.DEFAULTED))).first() is not None


def get(s: Session, loan_id: str) -> LoanRow:
    loan = s.get(LoanRow, loan_id)
    if loan is None:
        raise NotFound(f"Loan {loan_id} not found.")
    return loan


def draw(s: Session, chain: ChainService, app: Application, settings=None) -> LoanRow:
    """Book the loan and enqueue the vault → borrower transfer. Caller has checked eligibility."""
    p = s.get(Pool, app.pool_id)
    org = s.get(Organization, app.borrower_org_id)
    w = wallets.require_primary(s, org)
    st_pool = poolcore.draw(pools.load(p), app.requested)  # InsufficientLiquidity if the vault is short
    day = clock.today(s)
    st = new_loan(app.requested, p.borrower_apr_bps, p.term_epochs)
    n = len(s.exec(select(LoanRow.id)).all())
    loan = LoanRow(id=f"LN-{n + 1:04d}", pool_id=p.id, application_id=app.id, borrower_org_id=org.id,
                   borrower_id=org.pseudonym, principal=app.requested, apr_bps=p.borrower_apr_bps,
                   epochs=p.term_epochs, installment=st.schedule[0].total, state_json=json.dumps(st.to_dict()),
                   status=str(st.status), drawn_day=day)
    s.add(loan)
    pools.save(s, p, st_pool)
    xfer = transfers.enqueue(s, "DRAWDOWN", [Leg(f"vault:{p.vault_index}", w.address, spl.to_base(app.requested))],
                             ref_type="loan", ref_id=loan.id, org_id=org.id, meta={"pool_id": p.id, "loan_id": loan.id})
    loan.drawdown_transfer_id = xfer.id
    app.status = "DRAWN"
    s.add(app)
    for src in s.exec(select(RevenueSource).where(RevenueSource.org_id == org.id, RevenueSource.kind == "DEMO",
                                                  RevenueSource.profile == "distressed")):
        src.collapse_day = day + DISTRESS_AFTER_DAYS
        s.add(src)
    ledger.append(s, day, "LoanDrawn", {
        "pool_id": p.id, "loan_id": loan.id, "borrower": org.pseudonym, "principal": app.requested,
        "apr_bps": p.borrower_apr_bps, "epochs": p.term_epochs, "installment": loan.installment,
        "proof_id": app.proof_id, "transfer_id": xfer.id})
    notify.notify(s, p.manager_org_id, "loan_drawn", f"{loan.id} drawn from {p.name}",
                  f"{org.pseudonym} drew ${app.requested / 100:,.2f}.", f"/app/my-pools/{p.id}",
                  email=True, settings=settings)
    notify.notify(s, org.id, "loan_drawn", f"Funds on the way: ${app.requested / 100:,.2f}",
                  "Your drawdown is being sent to your wallet as cUSD.", f"/app/loans/{loan.id}",
                  email=True, settings=settings)
    return loan


def private_view(s: Session, chain: ChainService, loan: LoanRow) -> dict:
    """Everything the borrower may see about their own loan. Never served publicly."""
    st = state(loan)
    p = s.get(Pool, loan.pool_id)
    pays = s.exec(select(PrivatePayment).where(PrivatePayment.loan_id == loan.id)
                  .order_by(col(PrivatePayment.id).desc()).limit(60)).all()
    totals = {"swept": 0, "released": 0, "count": 0}
    for row in s.exec(select(PrivatePayment).where(PrivatePayment.loan_id == loan.id)):
        totals["swept"] += row.swept
        totals["released"] += row.released
        totals["count"] += 1
    from credent.models import ChainTransfer

    xfer = s.get(ChainTransfer, loan.drawdown_transfer_id) if loan.drawdown_transfer_id else None
    return {
        "id": loan.id, "pool": {"id": p.id, "slug": p.slug, "name": p.name}, "principal": loan.principal,
        "apr_bps": loan.apr_bps, "epochs": loan.epochs, "installment": loan.installment, "status": loan.status,
        "drawn_day": loan.drawn_day, "drawn_date": clock.iso_date(s, loan.drawn_day),
        "outstanding": st.outstanding, "arrears": st.arrears_interest + st.arrears_principal,
        "due_now": st.due(), "owed_this_week": st.owed() if loan.status not in [str(c) for c in CLOSED] else 0,
        "swept_this_week": st.swept, "epoch": st.epoch, "consecutive_short": st.consecutive_short,
        "schedule": [{"epoch": i, "interest": x.interest, "principal": x.principal, "total": x.total}
                     for i, x in enumerate(st.schedule)],
        "history": st.history,
        "payments": [{"id": r.id, "day": r.day, "date": clock.iso_date(s, r.day), "amount": r.amount,
                      "swept": r.swept, "released": r.released} for r in pays],
        "totals": totals,
        "drawdown": {"status": xfer.status, "signature": xfer.signature,
                     "explorer_url": transfers.explorer(chain, xfer)} if xfer else None,
    }
