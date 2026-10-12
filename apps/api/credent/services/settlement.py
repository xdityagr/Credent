"""Weekly settlement per pool: close loan epochs, run the waterfall, move the cash on-chain.

Week boundaries are global (day % 7 == 0). A loan's first installment falls due
at the first boundary at least one full week after drawdown.
"""

from sqlmodel import Session, col, select

from credent import ledger
from credent.chain import spl
from credent.chain.service import Leg
from credent.core import pool as poolcore
from credent.core.sweep import CLOSED, LoanStatus, close_epoch
from credent.errors import InvalidAmount, StepOutOfOrder
from credent.models import LoanRow, NavSnapshot, Pool
from credent.services import clock, funds, loans, notify, pools, transfers

EPOCH_DAYS = 7


def _close(s: Session, loan: LoanRow, day: int):
    before = loans.state(loan)
    st, r = close_epoch(before)
    loans.save_state(s, loan, st)
    payload = {"pool_id": loan.pool_id, "loan_id": loan.id, "borrower": loan.borrower_id, "epoch": r.epoch,
               "due": r.due, "paid": r.paid}
    if r.event == "InstallmentShort":
        payload |= {"shortfall": r.shortfall, "consecutive_short": st.consecutive_short}
    ledger.append(s, day, r.event, payload)
    if st.status == LoanStatus.LATE and before.status == LoanStatus.ACTIVE:
        ledger.append(s, day, "LoanLate", {"pool_id": loan.pool_id, "loan_id": loan.id, "borrower": loan.borrower_id})
        notify.notify(s, loan.borrower_org_id, "loan_late", f"{loan.id} is behind",
                      f"This week's installment was short by ${r.shortfall / 100:,.2f}. Three short weeks is a default.",
                      f"/app/loans/{loan.id}")
    elif st.status == LoanStatus.REPAID:
        ledger.append(s, day, "LoanRepaid", {"pool_id": loan.pool_id, "loan_id": loan.id, "borrower": loan.borrower_id})
        notify.notify(s, loan.borrower_org_id, "loan_repaid", f"{loan.id} is fully repaid", "Nice work.",
                      f"/app/loans/{loan.id}")
    return st, r


def _write_off(s: Session, p: Pool, loan: LoanRow, st, day: int) -> None:
    state, la = poolcore.default(pools.load(p), st.outstanding)
    pools.save(s, p, state)
    ledger.append(s, day, "LoanDefaulted", {"pool_id": p.id, "loan_id": loan.id, "borrower": loan.borrower_id,
                                            "outstanding": st.outstanding})
    ledger.append(s, day, "LossAllocated", {"pool_id": p.id, "loan_id": loan.id, "loss": la.loss,
                                            "junior": la.junior, "senior": la.senior})
    notify.notify(s, p.manager_org_id, "loan_defaulted", f"{loan.id} defaulted in {p.name}",
                  f"${la.loss / 100:,.2f} written off: junior ${la.junior / 100:,.2f}, senior ${la.senior / 100:,.2f}.",
                  f"/app/my-pools/{p.id}")
    notify.notify(s, loan.borrower_org_id, "loan_defaulted", f"{loan.id} has defaulted",
                  "Contact the pool manager to arrange recovery.", f"/app/loans/{loan.id}")


def _distribute(s: Session, p: Pool, interest: int, principal: int, days: int, day: int, loan_ids: list[str]):
    state, d = poolcore.distribute(pools.load(p), interest, principal, days, pools.terms(p))
    pools.save(s, p, state)
    ledger.append(s, day, "InterestDistributed", {
        "pool_id": p.id, "loans": loan_ids, "interest": d.interest, "principal": d.principal, "fee": d.fee,
        "senior": d.senior, "junior": d.junior, "senior_arrears": d.senior_arrears})
    if interest + principal:
        transfers.enqueue(s, "SETTLEMENT", [Leg("collections", f"vault:{p.vault_index}", spl.to_base(interest + principal)),
                                            Leg(f"vault:{p.vault_index}", "treasury", spl.to_base(d.fee))],
                          ref_type="settlement", ref_id=f"{p.id}:{day}", meta={"pool_id": p.id})
    return d


def snapshot(s: Session, p: Pool, day: int) -> None:
    st = pools.load(p)
    s.merge(NavSnapshot(pool_id=p.id, day=day, senior_nav=st.senior.nav, junior_nav=st.junior.nav,
                        senior_price_e6=funds.price_e6(st.senior), junior_price_e6=funds.price_e6(st.junior),
                        outstanding=st.outstanding, cash=st.cash))


def settle_week(s: Session, day: int) -> None:
    st = clock.state(s)
    if day <= st.last_settled_day:
        return  # already settled (e.g. a concurrent clock tick)
    st.last_settled_day = day
    s.add(st)
    for p in s.exec(select(Pool).where(Pool.status != "DRAFT").order_by(col(Pool.created))).all():
        interest = principal = 0
        settled, defaults = [], []
        for loan in s.exec(select(LoanRow).where(LoanRow.pool_id == p.id,
                                                 col(LoanRow.status).not_in([str(c) for c in CLOSED]))
                           .order_by(col(LoanRow.id))).all():
            if day - loan.drawn_day < EPOCH_DAYS:
                continue
            st, r = _close(s, loan, day)
            interest += r.interest
            principal += r.principal
            settled.append(loan.id)
            if st.status == LoanStatus.DEFAULTED:
                defaults.append((loan, st))
        if settled or pools.load(p).outstanding:
            _distribute(s, p, interest, principal, EPOCH_DAYS, day, settled)
        for loan, st in defaults:
            _write_off(s, p, loan, st, day)
        snapshot(s, p, day)
    ledger.seal_block(s, day)


def force_default(s: Session, loan_id: str) -> None:
    loan = loans.get(s, loan_id)
    st = loans.state(loan)
    if st.status in CLOSED:
        raise StepOutOfOrder(f"Loan {loan_id} is already {st.status}.")
    p = s.get(Pool, loan.pool_id)
    day = clock.today(s)
    if st.swept:  # this week's swept cash belongs to the pool: settle it before the write-off
        st, r = _close(s, loan, day)
        _distribute(s, p, r.interest, r.principal, 0, day, [loan.id])
        if st.status == LoanStatus.REPAID:
            return
    st.status = LoanStatus.DEFAULTED
    loans.save_state(s, loan, st)
    _write_off(s, p, loan, st, day)
    snapshot(s, p, day)


def recover(s: Session, loan_id: str, amount: int) -> None:
    """Recovered cash (e.g. from a collections agency) arrives in the pool vault and restores senior first."""
    loan = loans.get(s, loan_id)
    if loan.status != LoanStatus.DEFAULTED:
        raise StepOutOfOrder("Only defaulted loans can have recoveries.")
    if not isinstance(amount, int) or amount <= 0:
        raise InvalidAmount()
    p = s.get(Pool, loan.pool_id)
    state, ra = poolcore.recover(pools.load(p), amount)
    pools.save(s, p, state)
    transfers.enqueue(s, "SETTLEMENT", [Leg("mint", f"vault:{p.vault_index}", spl.to_base(amount))],
                      ref_type="recovery", ref_id=loan.id, meta={"pool_id": p.id, "loan_id": loan.id})
    ledger.append(s, clock.today(s), "RecoveryAllocated", {"pool_id": p.id, "loan_id": loan.id, "amount": ra.amount,
                                                           "senior": ra.senior, "junior": ra.junior})
    snapshot(s, p, clock.today(s))

