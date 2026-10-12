"""Lockbox sweep: incoming flows repay the installment before the borrower sees them.

Pure functions over `LoanState`. Payments accumulate in `swept` during an epoch.
`close_epoch` allocates the swept amount interest-first across arrears and the
current installment, and carries any shortfall forward as arrears.
"""

from dataclasses import asdict, dataclass, field, replace
from enum import StrEnum

from .amortize import Installment, amortize

DEFAULT_AFTER = 3  # consecutive short epochs before default


class LoanStatus(StrEnum):
    ACTIVE = "ACTIVE"
    LATE = "LATE"
    DEFAULTED = "DEFAULTED"
    REPAID = "REPAID"


CLOSED = (LoanStatus.DEFAULTED, LoanStatus.REPAID)


@dataclass
class LoanState:
    schedule: list[Installment]
    outstanding: int
    epoch: int = 0
    swept: int = 0
    arrears_interest: int = 0
    arrears_principal: int = 0
    consecutive_short: int = 0
    status: LoanStatus = LoanStatus.ACTIVE
    history: list[dict] = field(default_factory=list)

    def current(self) -> Installment:
        if self.epoch < len(self.schedule):
            return self.schedule[self.epoch]
        return Installment(0, 0)

    def owed(self) -> int:
        """Total owed this epoch (arrears + current installment), before payments."""
        return self.arrears_interest + self.arrears_principal + self.current().total

    def due(self) -> int:
        """What the sweep will still take this epoch."""
        if self.status in CLOSED:
            return 0
        return max(0, self.owed() - self.swept)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["status"] = str(self.status)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "LoanState":
        d = dict(d)
        d["schedule"] = [Installment(**i) for i in d["schedule"]]
        d["status"] = LoanStatus(d["status"])
        return cls(**d)


@dataclass(frozen=True)
class EpochResult:
    epoch: int
    due: int
    paid: int
    shortfall: int
    interest: int
    principal: int
    status: LoanStatus
    event: str  # "InstallmentPaid" | "InstallmentShort"


def new_loan(principal: int, apr_bps: int, epochs: int) -> LoanState:
    return LoanState(schedule=amortize(principal, apr_bps, epochs), outstanding=principal)


def apply_payment(s: LoanState, amount: int) -> tuple[LoanState, int, int]:
    """Route one incoming payment. Returns (state, swept, released_to_borrower)."""
    if amount < 0:
        raise ValueError("payment amount must be non-negative")
    take = min(amount, s.due())
    return replace(s, swept=s.swept + take), take, amount - take


def close_epoch(s: LoanState) -> tuple[LoanState, EpochResult]:
    if s.status in CLOSED:
        raise ValueError(f"cannot close an epoch on a {s.status} loan")

    cur = s.current()
    remaining = s.swept

    def take(bucket: int) -> int:
        nonlocal remaining
        t = min(bucket, remaining)
        remaining -= t
        return t

    # Interest-first across arrears, then the current installment.
    ai = take(s.arrears_interest)
    ap = take(s.arrears_principal)
    ci = take(cur.interest)
    cp = take(cur.principal)
    assert remaining == 0, "sweep never takes more than is owed"

    owed = s.owed()
    paid = s.swept
    shortfall = owed - paid
    paid_interest = ai + ci
    paid_principal = ap + cp

    n = replace(
        s,
        epoch=s.epoch + 1,
        swept=0,
        arrears_interest=s.arrears_interest - ai + cur.interest - ci,
        arrears_principal=s.arrears_principal - ap + cur.principal - cp,
        outstanding=s.outstanding - paid_principal,
    )

    if shortfall == 0:
        event = "InstallmentPaid"
        n.consecutive_short = 0
        done = n.epoch >= len(n.schedule) and n.outstanding == 0 and n.arrears_interest == 0
        n.status = LoanStatus.REPAID if done else LoanStatus.ACTIVE
    else:
        event = "InstallmentShort"
        n.consecutive_short = s.consecutive_short + 1
        n.status = LoanStatus.DEFAULTED if n.consecutive_short >= DEFAULT_AFTER else LoanStatus.LATE

    result = EpochResult(
        epoch=s.epoch,
        due=owed,
        paid=paid,
        shortfall=shortfall,
        interest=paid_interest,
        principal=paid_principal,
        status=n.status,
        event=event,
    )
    n.history = [*s.history, {"epoch": s.epoch, "due": owed, "paid": paid, "event": event}]
    return n, result
