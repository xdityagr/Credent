import pytest

from credent.core.pool import (
    SHARE_SCALE,
    Pool,
    default,
    deposit,
    distribute,
    draw,
    recover,
    share_value,
)
from credent.errors import InsufficientLiquidity, InvalidAmount, SubordinationBreach, TrancheImpaired


def funded(junior=100_000_00, senior=400_000_00) -> Pool:
    p = Pool()
    p, _ = deposit(p, "junior", junior)
    if senior:
        p, _ = deposit(p, "senior", senior)
    return p


def test_first_deposit_mints_one_to_one():
    p, shares = deposit(Pool(), "junior", 5_000_00)
    assert shares == 5_000_00 * SHARE_SCALE
    assert p.junior.nav == p.cash == 5_000_00
    p.check()


def test_later_deposit_mints_at_current_price():
    p = funded(senior=0)
    p.junior.nav *= 2  # price doubled
    p.cash *= 2
    p, shares = deposit(p, "junior", 10_000_00)
    assert shares == 5_000_00 * SHARE_SCALE


def test_subordination_boundary():
    p = funded(junior=100_000_00, senior=0)
    p, _ = deposit(p, "senior", 400_000_00)  # exactly 4x
    with pytest.raises(SubordinationBreach):
        deposit(p, "senior", 1)


def test_non_positive_deposit_rejected():
    with pytest.raises(InvalidAmount):
        deposit(Pool(), "junior", 0)


def test_draw_beyond_cash_rejected():
    p = funded()
    with pytest.raises(InsufficientLiquidity):
        draw(p, p.cash + 1)


def test_draw_moves_cash_to_outstanding():
    p = draw(funded(), 100_000_00)
    assert p.outstanding == 100_000_00
    assert p.cash == 400_000_00
    p.check()


def test_distribute_fee_senior_junior():
    p = draw(funded(), 250_000_00)  # half the pool deployed
    p, d = distribute(p, interest=10_000_00, principal=20_000_00, days=7)
    assert d.fee == 1_000_00
    # senior accrues 9% APR on its deployed share (50%) for 7 days
    expected_senior = 400_000_00 * 250_000_00 * 900 * 7 // (500_000_00 * 10_000 * 365)
    assert d.senior == expected_senior
    assert d.junior == 10_000_00 - 1_000_00 - expected_senior
    assert d.senior_arrears == 0
    assert p.treasury == 1_000_00
    assert p.outstanding == 230_000_00
    p.check()


def test_idle_pool_accrues_no_senior_coupon():
    p = funded()
    p, d = distribute(p, interest=0, principal=0, days=7)
    assert d.senior == 0 and d.senior_arrears == 0
    p.check()


def test_empty_pool_distribution_is_safe():
    p, d = distribute(Pool(), interest=0, principal=0, days=7)
    assert d.senior == 0
    p.check()


def test_senior_shortfall_carries_and_catches_up():
    p = draw(funded(), 500_000_00)
    p, d1 = distribute(p, interest=0, principal=0, days=7)
    assert d1.senior_arrears > 0
    owed = d1.senior_arrears
    p, d2 = distribute(p, interest=owed * 10, principal=0, days=7)
    assert d2.senior >= owed
    assert d2.senior_arrears == 0
    assert p.senior.coupon_arrears == 0
    p.check()


def test_loss_smaller_than_junior():
    p = draw(funded(), 50_000_00)
    p, la = default(p, 50_000_00)
    assert (la.junior, la.senior) == (50_000_00, 0)
    assert p.junior.nav == 50_000_00
    assert p.senior.nav == 400_000_00
    p.check()


def test_loss_equal_to_junior():
    p = draw(funded(), 100_000_00)
    p, la = default(p, 100_000_00)
    assert (la.junior, la.senior) == (100_000_00, 0)
    assert p.junior.nav == 0
    p.check()


def test_loss_impairs_senior():
    p = draw(funded(), 150_000_00)
    p, la = default(p, 150_000_00)
    assert (la.junior, la.senior) == (100_000_00, 50_000_00)
    assert p.senior.writedown == 50_000_00
    p.check()


def test_loss_with_everything_deployed_wipes_both():
    p = draw(funded(), 500_000_00)
    p, la = default(p, 500_000_00)
    assert (la.junior, la.senior) == (100_000_00, 400_000_00)
    assert p.junior.nav == p.senior.nav == 0
    p.check()


def test_recovery_restores_senior_first():
    p = draw(funded(), 150_000_00)
    p, _ = default(p, 150_000_00)
    p, ra = recover(p, 30_000_00)
    assert (ra.senior, ra.junior) == (30_000_00, 0)
    assert p.senior.writedown == 20_000_00
    p.check()


def test_recovery_overflows_to_junior_and_gain():
    p = draw(funded(), 150_000_00)
    p, _ = default(p, 150_000_00)
    p, ra = recover(p, 200_000_00)
    assert ra.senior == 50_000_00
    assert ra.junior == 150_000_00
    assert p.senior.writedown == 0 and p.junior.writedown == 0
    assert p.junior.nav == 150_000_00  # 0 + 100k restored + 50k gain
    p.check()


def test_impaired_tranche_rejects_deposits():
    p = draw(funded(), 100_000_00)
    p, _ = default(p, 100_000_00)
    with pytest.raises(TrancheImpaired):
        deposit(p, "junior", 1_000_00)


def test_share_value():
    p = funded(senior=0)
    p.junior.nav = 150_000_00
    p.cash = 150_000_00
    assert share_value(p.junior, 50_000_00 * SHARE_SCALE) == 75_000_00
    assert share_value(Pool().junior, 10) == 0


def test_operations_do_not_mutate_input():
    p = draw(funded(), 5_000_00)
    before = p.to_dict()
    draw(p, 1_000_00)
    distribute(p, 100, 100, 7)
    default(p, 1_000_00)
    recover(p, 1_000_00)
    deposit(p, "junior", 1_000_00)
    assert p.to_dict() == before


def test_roundtrip_dict():
    p = draw(funded(), 1_000_00)
    assert Pool.from_dict(p.to_dict()) == p


def test_deposit_value_is_exact_at_fractional_price():
    p = draw(funded(junior=400_000_00, senior=0), 100_000_00)
    p, _ = distribute(p, interest=1_234_57, principal=0, days=7)  # junior price now fractional
    p, minted = deposit(p, "junior", 50_000_00)
    assert share_value(p.junior, minted) == 50_000_00


# ---- v2: per-pool terms and withdrawals ----
from credent.core.pool import PoolTerms, withdraw  # noqa: E402


def test_custom_leverage_cap():
    terms = PoolTerms(max_leverage_x100=200)
    p, _ = deposit(Pool(), "junior", 100_000_00, terms)
    p, _ = deposit(p, "senior", 200_000_00, terms)
    with pytest.raises(SubordinationBreach):
        deposit(p, "senior", 1, terms)


def test_custom_coupon_and_fee():
    terms = PoolTerms(senior_coupon_bps=1200, fee_bps=500)
    p, _ = deposit(Pool(), "junior", 100_000_00, terms)
    p, _ = deposit(p, "senior", 400_000_00, terms)
    p = draw(p, 500_000_00)
    p, d = distribute(p, interest=10_000_00, principal=0, days=7, terms=terms)
    assert d.fee == 500_00
    assert d.senior == 400_000_00 * 1200 * 7 // (10_000 * 365)


def test_withdraw_returns_value_and_burns_shares():
    p, minted = deposit(Pool(), "junior", 100_000_00)
    p, amount = withdraw(p, "junior", minted // 2)
    assert amount == 50_000_00
    assert p.junior.nav == 50_000_00 and p.cash == 50_000_00
    p.check()


def test_full_withdraw_takes_everything():
    p, minted = deposit(Pool(), "junior", 100_000_00)
    p.junior.nav += 1_23  # gains accrued
    p.cash += 1_23
    p, amount = withdraw(p, "junior", minted)
    assert amount == 100_001_23 and p.junior.shares == 0 and p.cash == 0


def test_withdraw_needs_liquidity():
    p, minted = deposit(Pool(), "junior", 100_000_00)
    p = draw(p, 90_000_00)
    with pytest.raises(InsufficientLiquidity):
        withdraw(p, "junior", minted)


def test_junior_withdraw_cannot_breach_subordination():
    p = funded(junior=100_000_00, senior=400_000_00)
    with pytest.raises(SubordinationBreach):
        withdraw(p, "junior", 1_000 * SHARE_SCALE)


def test_withdraw_more_shares_than_exist():
    p, minted = deposit(Pool(), "junior", 100_000_00)
    with pytest.raises(InvalidAmount):
        withdraw(p, "junior", minted + 1)
