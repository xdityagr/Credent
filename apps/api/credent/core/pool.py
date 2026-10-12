"""Tranched pool and its waterfalls.

Invariant (checked by `Pool.check`): cash + outstanding == senior.nav + junior.nav.
Protocol fees leave the pool to `treasury`, outside the identity.

Interest waterfall: protocol fee -> senior coupon (plus arrears) -> junior residual.
Loss waterfall:     junior first -> senior.
Recovery waterfall: senior write-downs first -> junior write-downs -> junior gain.
"""

import copy
from dataclasses import asdict, dataclass, field

from credent.errors import InsufficientLiquidity, InvalidAmount, SubordinationBreach, TrancheImpaired

SENIOR_COUPON_BPS = 900
MAX_LEVERAGE = 4
FEE_BPS = 1000
SHARE_SCALE = 10**6  # shares per cent at the initial price, so rounding stays sub-cent
TRANCHES = ("senior", "junior")


@dataclass(frozen=True)
class PoolTerms:
    """Economics a pool manager chooses. Defaults are the v1 protocol terms."""
    senior_coupon_bps: int = SENIOR_COUPON_BPS
    max_leverage_x100: int = MAX_LEVERAGE * 100  # senior may be at most this/100 x junior
    fee_bps: int = FEE_BPS

    def senior_cap(self, junior_nav: int) -> int:
        return self.max_leverage_x100 * junior_nav // 100


DEFAULT_TERMS = PoolTerms()


@dataclass
class Tranche:
    name: str
    nav: int = 0
    shares: int = 0
    coupon_arrears: int = 0
    writedown: int = 0


@dataclass
class Pool:
    cash: int = 0
    outstanding: int = 0
    treasury: int = 0
    senior: Tranche = field(default_factory=lambda: Tranche("senior"))
    junior: Tranche = field(default_factory=lambda: Tranche("junior"))

    def tranche(self, name: str) -> Tranche:
        if name not in TRANCHES:
            raise InvalidAmount(f"Unknown tranche '{name}'.")
        return getattr(self, name)

    @property
    def total_nav(self) -> int:
        return self.senior.nav + self.junior.nav

    def check(self) -> None:
        assert self.cash + self.outstanding == self.total_nav, (
            f"identity broken: cash {self.cash} + outstanding {self.outstanding} "
            f"!= nav {self.total_nav}"
        )

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Pool":
        d = dict(d)
        d["senior"] = Tranche(**d["senior"])
        d["junior"] = Tranche(**d["junior"])
        return cls(**d)


@dataclass(frozen=True)
class Distribution:
    interest: int
    principal: int
    fee: int
    senior: int
    junior: int
    senior_arrears: int


@dataclass(frozen=True)
class LossAllocation:
    loss: int
    junior: int
    senior: int


@dataclass(frozen=True)
class RecoveryAllocation:
    amount: int
    senior: int
    junior: int


def _positive(amount: int) -> None:
    if not isinstance(amount, int) or amount <= 0:
        raise InvalidAmount()


def share_value(t: Tranche, shares: int) -> int:
    return (shares * t.nav + t.shares // 2) // t.shares if t.shares else 0


def deposit(p: Pool, tranche_name: str, amount: int, terms: PoolTerms = DEFAULT_TERMS) -> tuple[Pool, int]:
    _positive(amount)
    p = copy.deepcopy(p)
    t = p.tranche(tranche_name)
    if t.shares and t.nav == 0:
        raise TrancheImpaired()
    if tranche_name == "senior" and p.senior.nav + amount > terms.senior_cap(p.junior.nav):
        room = max(0, terms.senior_cap(p.junior.nav) - p.senior.nav)
        raise SubordinationBreach(
            f"Senior capital may not exceed {terms.max_leverage_x100 / 100:g}x junior. "
            f"Room left: {room} cents."
        )
    minted = amount * SHARE_SCALE if t.shares == 0 else amount * t.shares // t.nav
    t.shares += minted
    t.nav += amount
    p.cash += amount
    return p, minted


def draw(p: Pool, amount: int) -> Pool:
    _positive(amount)
    if amount > p.cash:
        raise InsufficientLiquidity(
            f"Pool has {p.cash} cents of idle cash; requested {amount}."
        )
    p = copy.deepcopy(p)
    p.cash -= amount
    p.outstanding += amount
    return p


def distribute(p: Pool, interest: int, principal: int, days: int,
               terms: PoolTerms = DEFAULT_TERMS) -> tuple[Pool, Distribution]:
    """Apply one epoch of collections for a loan through the interest waterfall."""
    if interest < 0 or principal < 0 or principal > p.outstanding:
        raise ValueError("invalid collection amounts")
    p = copy.deepcopy(p)

    # Senior accrues its coupon only on its pro-rata share of deployed capital.
    accrued = 0
    if p.total_nav > 0:
        accrued = (p.senior.nav * p.outstanding * terms.senior_coupon_bps * days) // (
            p.total_nav * 10_000 * 365
        )

    p.cash += interest + principal
    p.outstanding -= principal

    fee = interest * terms.fee_bps // 10_000
    p.cash -= fee
    p.treasury += fee
    remaining = interest - fee

    senior_due = accrued + p.senior.coupon_arrears
    to_senior = min(remaining, senior_due)
    p.senior.coupon_arrears = senior_due - to_senior
    p.senior.nav += to_senior
    to_junior = remaining - to_senior
    p.junior.nav += to_junior

    return p, Distribution(
        interest=interest,
        principal=principal,
        fee=fee,
        senior=to_senior,
        junior=to_junior,
        senior_arrears=p.senior.coupon_arrears,
    )


def default(p: Pool, outstanding_principal: int) -> tuple[Pool, LossAllocation]:
    """Write off a defaulted loan's outstanding principal: junior first, then senior."""
    if outstanding_principal < 0 or outstanding_principal > p.outstanding:
        raise ValueError("loss exceeds pool outstanding")
    p = copy.deepcopy(p)
    loss = outstanding_principal
    p.outstanding -= loss
    j = min(loss, p.junior.nav)
    p.junior.nav -= j
    p.junior.writedown += j
    s = min(loss - j, p.senior.nav)
    p.senior.nav -= s
    p.senior.writedown += s
    assert j + s == loss  # guaranteed by the identity: outstanding <= total nav
    return p, LossAllocation(loss=loss, junior=j, senior=s)


def recover(p: Pool, amount: int) -> tuple[Pool, RecoveryAllocation]:
    """Recovered cash restores senior write-downs first, then junior (incl. any gain)."""
    _positive(amount)
    p = copy.deepcopy(p)
    p.cash += amount
    s = min(amount, p.senior.writedown)
    p.senior.writedown -= s
    p.senior.nav += s
    rest = amount - s
    p.junior.writedown -= min(rest, p.junior.writedown)
    p.junior.nav += rest
    return p, RecoveryAllocation(amount=amount, senior=s, junior=rest)


def withdraw(p: Pool, tranche_name: str, shares: int, terms: PoolTerms = DEFAULT_TERMS) -> tuple[Pool, int]:
    """Burn `shares` of a tranche for their current value, paid from idle cash."""
    if not isinstance(shares, int) or shares <= 0:
        raise InvalidAmount("Shares must be a positive integer.")
    p = copy.deepcopy(p)
    t = p.tranche(tranche_name)
    if shares > t.shares:
        raise InvalidAmount("Cannot withdraw more shares than the tranche has.")
    amount = t.nav if shares == t.shares else shares * t.nav // t.shares  # round down: pool keeps dust
    if amount > p.cash:
        raise InsufficientLiquidity(f"Only {p.cash} cents of the pool is idle; {amount} requested.")
    if tranche_name == "junior" and p.senior.nav > terms.senior_cap(t.nav - amount):
        raise SubordinationBreach("This withdrawal would leave senior over-levered against junior.")
    t.shares -= shares
    t.nav -= amount
    p.cash -= amount
    return p, amount
