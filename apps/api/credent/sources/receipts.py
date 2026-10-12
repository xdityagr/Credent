"""Processor-signed payment receipts: the second way to prove revenue history."""

import hashlib
import random

from nacl.signing import SigningKey

from credent.crypto.canonical import canonical_json
from credent.crypto.keys import sign_b64, verify_b64
from credent.errors import ReceiptInvalid

from .profiles import split_payments

FIELDS = ("id", "day", "amount", "currency")


def _body(r: dict) -> bytes:
    return canonical_json({k: r[k] for k in FIELDS}).encode()


def make_receipts(series: list[int], start_day: int, processor_key: SigningKey,
                  tampered: bool = False) -> list[dict]:
    rows = []
    for offset, total in enumerate(series):
        day = start_day + offset
        for i, amount in enumerate(split_payments(total, random.Random(f"r:{day}:{total}"))):
            rid = "rcpt_" + hashlib.sha256(f"{day}:{i}:{amount}:{total}".encode()).hexdigest()[:16]
            r = {"id": rid, "day": day, "amount": amount, "currency": "USD"}
            r["sig"] = sign_b64(processor_key, _body(r))
            rows.append(r)
    if tampered and rows:
        rows[len(rows) // 2]["amount"] *= 10  # inflate revenue without re-signing
    return rows


def parse_receipts(rows: list[dict], processor_pubkey: str, period_start: int, days: int) -> list[int]:
    """Validate receipts and bucket them into daily totals for the period."""
    daily = [0] * days
    seen: set[str] = set()
    for r in rows:
        try:
            rid, day, amount = str(r["id"]), int(r["day"]), int(r["amount"])
            sig, currency = str(r["sig"]), str(r["currency"])
        except (KeyError, TypeError, ValueError):
            raise ReceiptInvalid("Malformed receipt: expected id, day, amount, currency, sig.")
        if currency != "USD" or amount <= 0:
            raise ReceiptInvalid(f"Receipt {rid}: unsupported currency or non-positive amount.")
        if not verify_b64(processor_pubkey, _body(r), sig):
            raise ReceiptInvalid(f"Receipt {rid}: processor signature does not match.")
        if rid in seen:
            raise ReceiptInvalid(f"Receipt {rid}: duplicate receipt id.")
        seen.add(rid)
        if not period_start <= day < period_start + days:
            raise ReceiptInvalid(f"Receipt {rid}: day {day} is outside the attested period.")
        daily[day - period_start] += amount
    return daily
