import random

import pytest

from credent.crypto.keys import KeyStore, pubkey_b58
from credent.errors import ReceiptInvalid
from credent.sources.profiles import PROFILES, daily_revenue, split_payments
from credent.sources.receipts import make_receipts, parse_receipts


def test_daily_revenue_is_deterministic_and_positive():
    a = daily_revenue(PROFILES["saas"], seed=7, start_day=0, days=90)
    b = daily_revenue(PROFILES["saas"], seed=7, start_day=0, days=90)
    assert a == b and len(a) == 90 and all(v > 0 for v in a)
    assert daily_revenue(PROFILES["saas"], seed=8, start_day=0, days=90) != a


def test_ecommerce_is_more_volatile_than_saas():
    def spread(xs):
        return (max(xs) - min(xs)) / (sum(xs) / len(xs))

    saas = daily_revenue(PROFILES["saas"], 1, 0, 90)
    ecom = daily_revenue(PROFILES["ecommerce"], 1, 0, 90)
    assert spread(ecom) > spread(saas)


def test_collapse_day_cuts_revenue():
    p = PROFILES["distressed"]
    before = daily_revenue(p, 3, 100, 10)
    after = daily_revenue(p, 3, 100, 10, collapse_day=100)
    assert sum(after) < sum(before) * 0.3


@pytest.mark.parametrize("amount", [1, 7, 12345, 9_999_99])
def test_split_payments_sums(amount):
    parts = split_payments(amount, random.Random(amount))
    assert sum(parts) == amount and 1 <= len(parts) <= 4 and all(p > 0 for p in parts)


@pytest.fixture
def processor(tmp_path):
    return KeyStore(tmp_path).get("processor")


def test_receipts_roundtrip(processor):
    series = daily_revenue(PROFILES["saas"], 5, 0, 90)
    rows = make_receipts(series, 0, processor)
    assert parse_receipts(rows, pubkey_b58(processor), 0, 90) == series


def test_tampered_receipt_rejected(processor):
    series = daily_revenue(PROFILES["saas"], 5, 0, 90)
    rows = make_receipts(series, 0, processor, tampered=True)
    with pytest.raises(ReceiptInvalid, match="signature"):
        parse_receipts(rows, pubkey_b58(processor), 0, 90)


def test_duplicate_receipt_rejected(processor):
    rows = make_receipts([100_00] * 90, 0, processor)
    with pytest.raises(ReceiptInvalid, match="duplicate"):
        parse_receipts(rows + rows[:1], pubkey_b58(processor), 0, 90)


def test_out_of_period_receipt_rejected(processor):
    rows = make_receipts([100_00] * 90, 0, processor)
    with pytest.raises(ReceiptInvalid, match="period"):
        parse_receipts(rows, pubkey_b58(processor), 1, 90)


def test_malformed_receipt_rejected(processor):
    with pytest.raises(ReceiptInvalid):
        parse_receipts([{"id": "x"}], pubkey_b58(processor), 0, 90)
