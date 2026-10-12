import pytest

from credent.core.sweep import DEFAULT_AFTER, LoanStatus, apply_payment, close_epoch, new_loan

PRINCIPAL = 120_000_00


def loan():
    return new_loan(PRINCIPAL, 1800, 12)


def test_new_loan_due_is_first_installment():
    s = loan()
    assert s.due() == s.schedule[0].total
    assert s.outstanding == PRINCIPAL


def test_exact_payment_fills_installment():
    s = loan()
    s, swept, released = apply_payment(s, s.schedule[0].total)
    assert (swept, released) == (s.schedule[0].total, 0)
    assert s.due() == 0


def test_partial_payments_then_overflow_released():
    s = loan()
    inst = s.schedule[0].total
    third = inst // 3
    s, a, ra = apply_payment(s, third)
    s, b, rb = apply_payment(s, third)
    s, c, rc = apply_payment(s, inst)  # more than what's left
    assert a + b + c == inst
    assert (ra, rb) == (0, 0)
    assert rc == inst - (inst - 2 * third)


def test_short_epoch_creates_interest_first_arrears():
    s = loan()
    inst = s.schedule[0]
    s, _, _ = apply_payment(s, inst.interest // 2)
    s, r = close_epoch(s)
    assert r.event == "InstallmentShort"
    assert r.shortfall == inst.total - inst.interest // 2
    assert s.arrears_interest == inst.interest - inst.interest // 2
    assert s.arrears_principal == inst.principal
    assert s.status == LoanStatus.LATE
    assert s.consecutive_short == 1
    assert s.outstanding == PRINCIPAL  # no principal was paid


def test_arrears_plus_current_cleared_by_one_payment():
    s = loan()
    s, _ = close_epoch(s)  # nothing paid
    expected_due = s.schedule[0].total + s.schedule[1].total
    assert s.due() == expected_due
    s, swept, released = apply_payment(s, expected_due + 500)
    assert (swept, released) == (expected_due, 500)
    s, r = close_epoch(s)
    assert r.event == "InstallmentPaid"
    assert s.status == LoanStatus.ACTIVE
    assert s.consecutive_short == 0
    assert s.arrears_interest == s.arrears_principal == 0


def test_consecutive_shorts_default():
    s = loan()
    for _ in range(DEFAULT_AFTER):
        s, r = close_epoch(s)
    assert s.status == LoanStatus.DEFAULTED
    assert r.status == LoanStatus.DEFAULTED


@pytest.mark.parametrize("status", [LoanStatus.DEFAULTED, LoanStatus.REPAID])
def test_payment_on_closed_loan_is_released(status):
    s = loan()
    s.status = status
    s, swept, released = apply_payment(s, 10_000)
    assert (swept, released) == (0, 10_000)


def test_full_repayment_and_totals_match_schedule():
    s = loan()
    interest = principal = 0
    for _ in range(12):
        s, _, _ = apply_payment(s, s.due())
        s, r = close_epoch(s)
        interest += r.interest
        principal += r.principal
    assert s.status == LoanStatus.REPAID
    assert s.outstanding == 0
    assert principal == PRINCIPAL
    assert interest == sum(i.interest for i in s.schedule)


def test_arrears_due_after_schedule_end():
    s = loan()
    for k in range(12):
        pay = s.due() if k != 11 else s.due() - 100
        s, _, _ = apply_payment(s, pay)
        s, _ = close_epoch(s)
    assert s.status == LoanStatus.LATE
    assert s.due() == 100
    s, _, _ = apply_payment(s, 100)
    s, r = close_epoch(s)
    assert s.status == LoanStatus.REPAID


def test_negative_payment_rejected():
    with pytest.raises(ValueError):
        apply_payment(loan(), -1)


def test_close_epoch_on_closed_loan_rejected():
    s = loan()
    s.status = LoanStatus.DEFAULTED
    with pytest.raises(ValueError):
        close_epoch(s)


def test_state_roundtrips_through_dict():
    from credent.core.sweep import LoanState

    s = loan()
    s, _, _ = apply_payment(s, 1234)
    assert LoanState.from_dict(s.to_dict()) == s
