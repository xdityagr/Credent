"""Deterministic demo world: seeded pool, three borrowers, simulated customer payments.

Week boundaries are global (day % 7 == 0). A loan's first installment falls due at
the first boundary at least one full week after drawdown, so all loans settle
together and the pool runs one waterfall per week.
"""

import hashlib
import json

from nacl.signing import SigningKey
from sqlmodel import Session, col, select

from credent import ledger
from credent.core import pool as poolcore
from credent.core.sweep import DEFAULT_AFTER, CLOSED, LoanStatus, apply_payment, close_epoch
from credent.crypto.keys import pubkey_b58
from credent.db import reset_db
from credent.errors import InvalidAmount, NotFound, StepOutOfOrder
from credent.models import Borrower, LoanRow, NavSnapshot, PrivatePayment
from credent.services import borrower as borrowers
from credent.services import clock, lender, pool_store
from credent.services.context import Ctx
from credent.sources.profiles import PROFILES, payments_for_day
from credent.terms import CREDIT_ADVANCE_BPS, EPOCH_DAYS, LOAN_APR_BPS, LOAN_EPOCHS

LENDERS = [("junior", 250_000_00), ("junior", 150_000_00),
           ("senior", 600_000_00), ("senior", 500_000_00), ("senior", 300_000_00)]
DEMO_BORROWERS = ["saas", "ecommerce", "distressed"]


def _wallet(tag: str) -> str:
    # Deterministic demo wallets so a reset reproduces the same public book.
    return pubkey_b58(SigningKey(hashlib.sha256(f"credent-demo:{tag}".encode()).digest()))


def reset(engine, ctx: Ctx, warmup_days: int = 28) -> None:
    ctx.prover.ensure_available()  # fail before wiping anything
    reset_db(engine)
    with Session(engine) as s:
        day = clock.today(s)
        ledger.append(s, day, "PoolCreated", {
            "name": "Credent Revenue Pool I",
            "senior_coupon_bps": poolcore.SENIOR_COUPON_BPS, "max_leverage": poolcore.MAX_LEVERAGE,
            "fee_bps": poolcore.FEE_BPS, "advance_bps": CREDIT_ADVANCE_BPS,
            "loan_apr_bps": LOAN_APR_BPS, "loan_epochs": LOAN_EPOCHS,
            "epoch_days": EPOCH_DAYS, "default_after_short_epochs": DEFAULT_AFTER,
        })
        for i, (tranche, amount) in enumerate(LENDERS):
            w = _wallet(f"lender-{i}")
            lender.faucet(s, w, amount)
            lender.deposit(s, w, tranche, amount)
        s.commit()
        for profile in DEMO_BORROWERS:
            w = _wallet(f"borrower-{profile}")
            view = borrowers.connect_stripe(s, w, profile)
            borrowers.attest(s, ctx, w)
            borrowers.prove(s, ctx, w, view["suggested_threshold"])
            line = borrowers.open_credit_line(s, w)
            borrowers.draw(s, w, line.limit)
            s.commit()
        _snapshot(s, day)
        ledger.seal_block(s, day)
        s.commit()
        if warmup_days:
            advance(s, warmup_days)


def _snapshot(s: Session, day: int) -> None:
    p = pool_store.load(s)
    s.merge(NavSnapshot(day=day, senior_nav=p.senior.nav, junior_nav=p.junior.nav,
                        senior_price_e6=lender.price_e6(p.senior), junior_price_e6=lender.price_e6(p.junior),
                        outstanding=p.outstanding, cash=p.cash))


def _open_loans(s: Session) -> list[LoanRow]:
    return list(s.exec(select(LoanRow).where(col(LoanRow.status).not_in([str(x) for x in CLOSED]))
                       .order_by(col(LoanRow.id))))


def _save_loan(s: Session, loan: LoanRow, state) -> None:
    loan.state_json = json.dumps(state.to_dict())
    loan.status = str(state.status)
    s.add(loan)


def _route(s: Session, b: Borrower, day: int, amount: int) -> PrivatePayment:
    loan = borrowers.active_loan(s, b)
    swept, released = 0, amount
    if loan:
        state, swept, released = apply_payment(borrowers.loan_state(loan), amount)
        _save_loan(s, loan, state)
    pay = PrivatePayment(borrower_id=b.id, loan_id=loan.id if loan else None, day=day,
                         amount=amount, swept=swept, released=released)
    s.add(pay)
    return pay


def _write_off(s: Session, loan: LoanRow, state, day: int) -> None:
    pool, la = poolcore.default(pool_store.load(s), state.outstanding)
    pool_store.save(s, pool)
    ledger.append(s, day, "LoanDefaulted", {"loan_id": loan.id, "borrower": loan.borrower_id,
                                            "outstanding": state.outstanding})
    ledger.append(s, day, "LossAllocated", {"loan_id": loan.id, "loss": la.loss,
                                            "junior": la.junior, "senior": la.senior})


def _close(s: Session, loan: LoanRow, day: int):
    """Close a loan's current epoch: allocate what was swept and publish the outcome."""
    before = borrowers.loan_state(loan)
    state, r = close_epoch(before)
    _save_loan(s, loan, state)
    payload = {"loan_id": loan.id, "borrower": loan.borrower_id, "epoch": r.epoch,
               "due": r.due, "paid": r.paid}
    if r.event == "InstallmentShort":
        payload |= {"shortfall": r.shortfall, "consecutive_short": state.consecutive_short}
    ledger.append(s, day, r.event, payload)
    if state.status == LoanStatus.LATE and before.status == LoanStatus.ACTIVE:
        ledger.append(s, day, "LoanLate", {"loan_id": loan.id, "borrower": loan.borrower_id})
    elif state.status == LoanStatus.REPAID:
        ledger.append(s, day, "LoanRepaid", {"loan_id": loan.id, "borrower": loan.borrower_id})
    return state, r


def _settle_week(s: Session, day: int) -> None:
    interest = principal = 0
    settled: list[str] = []
    defaults = []
    for loan in _open_loans(s):
        if day - loan.drawn_day < EPOCH_DAYS:
            continue  # first installment falls due at the next boundary
        state, r = _close(s, loan, day)
        interest += r.interest
        principal += r.principal
        settled.append(loan.id)
        if state.status == LoanStatus.DEFAULTED:
            defaults.append((loan, state))

    pool, d = poolcore.distribute(pool_store.load(s), interest, principal, EPOCH_DAYS)
    pool_store.save(s, pool)
    ledger.append(s, day, "InterestDistributed", {
        "loans": settled, "interest": d.interest, "principal": d.principal, "fee": d.fee,
        "senior": d.senior, "junior": d.junior, "senior_arrears": d.senior_arrears,
    })
    for loan, state in defaults:
        _write_off(s, loan, state, day)
    _snapshot(s, day)
    ledger.seal_block(s, day)


def _tick(s: Session, day: int) -> None:
    """Non-ledger SSE notice so live views refresh private state (payments) between settlements."""
    s.info.setdefault("published", []).append({"type": "SimTick", "day": day})


def advance(s: Session, days: int) -> int:
    if not 1 <= days <= 365:
        raise InvalidAmount("Advance between 1 and 365 days.")
    for _ in range(days):
        st = clock.state(s)
        day = st.day
        for b in s.exec(select(Borrower).order_by(col(Borrower.id))):
            for amount in payments_for_day(PROFILES[b.profile], b.seed, day, b.collapse_day):
                _route(s, b, day, amount)
        st.day = day + 1
        s.add(st)
        if st.day % EPOCH_DAYS == 0:
            _settle_week(s, st.day)
        _tick(s, st.day)
        s.commit()
    return clock.today(s)


def payment(s: Session, borrower_id: str, amount: int) -> PrivatePayment:
    if not isinstance(amount, int) or amount <= 0:
        raise InvalidAmount()
    b = s.get(Borrower, borrower_id)
    if b is None:
        raise NotFound(f"Borrower {borrower_id} not found.")
    pay = _route(s, b, clock.today(s), amount)
    _tick(s, clock.today(s))
    s.commit()
    return pay


def force_default(s: Session, loan_id: str) -> None:
    loan = borrowers.require_loan(s, loan_id)
    state = borrowers.loan_state(loan)
    if state.status in CLOSED:
        raise StepOutOfOrder(f"Loan {loan_id} is already {state.status}.")
    day = clock.today(s)
    if state.swept:
        # Cash already swept this week belongs to the pool: settle it before the write-off.
        state, r = _close(s, loan, day)
        pool, d = poolcore.distribute(pool_store.load(s), r.interest, r.principal, 0)
        pool_store.save(s, pool)
        ledger.append(s, day, "InterestDistributed", {
            "loans": [loan.id], "interest": d.interest, "principal": d.principal, "fee": d.fee,
            "senior": d.senior, "junior": d.junior, "senior_arrears": d.senior_arrears,
        })
        if state.status == LoanStatus.REPAID:
            s.commit()
            return
    state.status = LoanStatus.DEFAULTED
    _save_loan(s, loan, state)
    _write_off(s, loan, state, day)
    s.commit()


def recover(s: Session, loan_id: str, amount: int) -> None:
    loan = borrowers.require_loan(s, loan_id)
    if loan.status != LoanStatus.DEFAULTED:
        raise StepOutOfOrder("Only defaulted loans can have recoveries.")
    pool, ra = poolcore.recover(pool_store.load(s), amount)
    pool_store.save(s, pool)
    ledger.append(s, clock.today(s), "RecoveryAllocated", {
        "loan_id": loan.id, "amount": ra.amount, "senior": ra.senior, "junior": ra.junior})
    s.commit()
