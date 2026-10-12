"""Stripe (test mode) revenue connector.

Pulls succeeded USD charges with a restricted test key, buckets net amounts
(amount − refunded) into protocol days, and later polls new charges into the
lockbox. Keys are encrypted at rest and only test keys are accepted.
"""

import base64
import hashlib
import hmac
from datetime import datetime, timezone

import httpx
from cryptography.fernet import Fernet, InvalidToken

from credent.errors import InvalidAmount

API = "https://api.stripe.com/v1"
TEST_PREFIXES = ("rk_test_", "sk_test_")


class StripeError(InvalidAmount):
    code = "STRIPE_ERROR"


def check_key(key: str) -> str:
    key = (key or "").strip()
    if not key.startswith(TEST_PREFIXES):
        raise StripeError("Use a Stripe test-mode key (rk_test_… or sk_test_…). Live keys are refused.")
    return key


def fernet(master: bytes) -> Fernet:
    return Fernet(base64.urlsafe_b64encode(hmac.new(master, b"stripe-keys", hashlib.sha256).digest()))


def encrypt(master: bytes, key: str) -> str:
    return fernet(master).encrypt(key.encode()).decode()


def decrypt(master: bytes, token: str) -> str:
    try:
        return fernet(master).decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise StripeError("Stored Stripe key can't be decrypted; reconnect the source.") from e


def charges_since(key: str, created_gte: int, http: httpx.Client | None = None, max_pages: int = 50) -> list[dict]:
    http = http or httpx.Client(timeout=20)
    out, params = [], {"limit": 100, "created[gte]": created_gte}
    for _ in range(max_pages):
        r = http.get(f"{API}/charges", params=params, headers={"Authorization": f"Bearer {key}"})
        if r.status_code == 401:
            raise StripeError("Stripe rejected this key.")
        if r.status_code == 403:
            raise StripeError("This restricted key needs read access to Charges.")
        if r.status_code >= 400:
            raise StripeError(f"Stripe error: {r.json().get('error', {}).get('message', r.status_code)}")
        body = r.json()
        out += body.get("data", [])
        if not body.get("has_more") or not body["data"]:
            return out
        params["starting_after"] = body["data"][-1]["id"]
    return out


def net_usd(charge: dict) -> int:
    if charge.get("status") != "succeeded" or charge.get("currency") != "usd" or not charge.get("paid", True):
        return 0
    return max(0, int(charge.get("amount", 0)) - int(charge.get("amount_refunded", 0)))


def bucket(charges: list[dict], day_of_ts, period_start: int, days: int) -> list[int]:
    daily = [0] * days
    for c in charges:
        d = day_of_ts(int(c["created"]))
        if period_start <= d < period_start + days:
            daily[d - period_start] += net_usd(c)
    return daily


def account_ref(key: str) -> str:
    return "stripe:" + hashlib.sha256(key.encode()).hexdigest()[:20]


def ts_to_day(genesis: datetime, launch_day: int):
    g = genesis if genesis.tzinfo else genesis.replace(tzinfo=timezone.utc)
    g0 = datetime(g.year, g.month, g.day, tzinfo=timezone.utc)

    def day_of(ts: int) -> int:
        return launch_day + (datetime.fromtimestamp(ts, timezone.utc) - g0).days

    return day_of
