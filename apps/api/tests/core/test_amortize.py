import pytest

from credent.core.amortize import Installment, amortize


@pytest.mark.parametrize("principal", [1_000_000_00, 12_345_67, 100])
def test_principal_sums_exactly(principal):
    schedule = amortize(principal, 1800, 12)
    assert len(schedule) == 12
    assert sum(i.principal for i in schedule) == principal


def test_level_payments_except_last():
    schedule = amortize(1_000_000_00, 1800, 12)
    totals = {i.total for i in schedule[:-1]}
    assert len(totals) == 1
    assert abs(schedule[-1].total - schedule[0].total) <= 12  # rounding drift only


def test_interest_decreases():
    schedule = amortize(1_000_000_00, 1800, 12)
    interests = [i.interest for i in schedule]
    assert all(a > b for a, b in zip(interests, interests[1:]))


def test_zero_apr_has_no_interest():
    schedule = amortize(1_200_00, 0, 12)
    assert all(i.interest == 0 for i in schedule)
    assert sum(i.principal for i in schedule) == 1_200_00


def test_total_is_interest_plus_principal():
    assert Installment(interest=5, principal=7).total == 12


@pytest.mark.parametrize("principal,epochs", [(0, 12), (-5, 12), (100, 0)])
def test_rejects_bad_inputs(principal, epochs):
    with pytest.raises(ValueError):
        amortize(principal, 1800, epochs)
