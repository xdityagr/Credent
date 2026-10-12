"""Level-payment amortization in integer cents."""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


@dataclass(frozen=True)
class Installment:
    interest: int
    principal: int

    @property
    def total(self) -> int:
        return self.interest + self.principal


def _cents(x: Decimal) -> int:
    return int(x.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def amortize(principal: int, apr_bps: int, epochs: int, epoch_days: int = 7) -> list[Installment]:
    """Split a loan into `epochs` level installments.

    Every installment except the last has the same total. The last one absorbs
    rounding so the principal portions sum to `principal` exactly.
    """
    if principal <= 0 or epochs <= 0 or apr_bps < 0:
        raise ValueError("principal and epochs must be positive, apr non-negative")

    rate = Decimal(apr_bps) / Decimal(10_000) * Decimal(epoch_days) / Decimal(365)
    p = Decimal(principal)
    if rate == 0:
        payment = _cents(p / epochs)
    else:
        payment = _cents(p * rate / (1 - (1 + rate) ** -epochs))

    schedule: list[Installment] = []
    balance = principal
    for k in range(epochs):
        interest = _cents(Decimal(balance) * rate)
        if k == epochs - 1:
            part = balance
        else:
            part = max(0, min(balance, payment - interest))
        schedule.append(Installment(interest=interest, principal=part))
        balance -= part
    return schedule
