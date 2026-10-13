"""Stripe sandbox: a simulated Stripe account served through the real connector.

A sandbox key looks like `rk_test_sandbox_<profile>_<seed>`. Instead of calling
api.stripe.com, the connector gets an httpx client whose transport answers
`GET /v1/charges` exactly like Stripe does (newest first, `created[gte]`,
`limit`, `starting_after`, `has_more`). Charges are generated deterministically
per protocol day from a revenue profile, with customers, invoice numbers,
receipt links, refunds and the occasional failed payment, so the whole
connector path (pagination, bucketing, polling, idempotent ingest) runs as it
would against Stripe test mode.
"""

import hashlib
import random
import secrets
from datetime import datetime, timedelta, timezone

import httpx

from credent.sources.profiles import PROFILES, daily_revenue, split_payments

PREFIX = "rk_test_sandbox_"
CUSTOMERS = [
    "Acme Logistics", "Bluebird Cafe", "Northstar Labs", "Pine & Pixel", "Harbor Dental", "Orbit Fitness",
    "Juniper Studio", "Copperline Retail", "Atlas Robotics", "Saffron Kitchen", "Lumen Clinics", "Fieldstone Farms",
    "Wavecrest Travel", "Granite Legal", "Mosaic Media", "Tidewater Supply", "Ember Bakery", "Summit Analytics",
]
PLANS = {
    "saas": ["Pro plan (monthly)", "Team plan (monthly)", "Enterprise seats", "Annual plan", "Usage overage"],
    "ecommerce": ["Order", "Order", "Order", "Gift card", "Subscription box"],
    "distressed": ["Freight invoice", "Brokerage fee", "Freight invoice", "Detention charge"],
}


def is_sandbox(key: str) -> bool:
    return key.startswith(PREFIX)


def new_key(profile: str) -> str:
    if profile not in PROFILES:
        raise ValueError(f"unknown profile {profile}")
    return f"{PREFIX}{profile}_{secrets.token_hex(6)}"


def _parse(key: str) -> tuple[str, int]:
    profile, seed = key[len(PREFIX):].split("_", 1)
    return profile, int(hashlib.sha256(seed.encode()).hexdigest()[:12], 16)


def charges_for_day(key: str, day: int, day_start: datetime) -> list[dict]:
    """Every charge the sandbox account received on protocol `day` (oldest first)."""
    profile, seed = _parse(key)
    total = daily_revenue(PROFILES[profile], seed, day, 1)[0]
    rng = random.Random(f"{seed}:charges:{day}")
    out = []
    parts = split_payments(total, rng)
    if rng.random() < 0.15:  # a declined card attempt that day (not revenue)
        parts.append(-rng.randint(20_00, 400_00))
    for i, amount in enumerate(parts):
        failed = amount < 0
        amount = abs(amount)
        created = int((day_start + timedelta(hours=8 + 14 * (i + 1) / (len(parts) + 1),
                                             minutes=rng.randint(0, 59))).timestamp())
        cid = f"ch_sbx_{seed % 10**8:08d}{day:05d}{i:02d}"
        customer = CUSTOMERS[rng.randrange(len(CUSTOMERS))]
        inv = 1000 + (day * 7 + i) % 9000
        refunded = 0 if failed or rng.random() > 0.04 else min(amount, rng.randint(10_00, max(10_00, amount // 2)))
        out.append({
            "id": cid, "object": "charge", "created": created, "amount": amount,
            "amount_captured": 0 if failed else amount, "amount_refunded": refunded, "currency": "usd",
            "paid": not failed, "status": "failed" if failed else "succeeded", "refunded": refunded == amount,
            "description": f"Invoice INV-{inv} · {rng.choice(PLANS.get(profile, ['Payment']))}",
            "invoice": None if failed else f"in_sbx_{cid[7:]}",
            "billing_details": {"name": customer, "email": f"billing@{customer.lower().replace(' & ', '').replace(' ', '')}.example"},
            "payment_method_details": {"type": "card", "card": {"brand": rng.choice(["visa", "mastercard", "amex"]),
                                                                "last4": f"{rng.randint(0, 9999):04d}"}},
            "failure_message": "Your card was declined." if failed else None,
            "receipt_url": None if failed else f"https://pay.stripe.com/receipts/sandbox/{cid}",
            "livemode": False,
        })
    return out


def client(key: str, genesis: datetime, launch_day: int, today: int) -> httpx.Client:
    """An httpx client that answers the Stripe Charges API for this sandbox account, up to protocol `today`."""
    g = genesis if genesis.tzinfo else genesis.replace(tzinfo=timezone.utc)
    g0 = datetime(g.year, g.month, g.day, tzinfo=timezone.utc)

    def day_start(day: int) -> datetime:
        return g0 + timedelta(days=day - launch_day)

    def day_of(ts: int) -> int:
        return launch_day + (datetime.fromtimestamp(ts, timezone.utc) - g0).days

    def handle(req: httpx.Request) -> httpx.Response:
        if req.headers.get("Authorization") != f"Bearer {key}":
            return httpx.Response(401, json={"error": {"message": "Invalid API Key provided."}})
        if req.url.path != "/v1/charges":
            return httpx.Response(404, json={"error": {"message": "Unrecognized request URL."}})
        gte = int(req.url.params.get("created[gte]", "0"))
        limit = min(int(req.url.params.get("limit", "10")), 100)
        after = req.url.params.get("starting_after")
        first = max(day_of(gte), today - 400)
        charges = [c for d in range(first, today) for c in charges_for_day(key, d, day_start(d)) if c["created"] >= gte]
        charges.sort(key=lambda c: (c["created"], c["id"]), reverse=True)  # Stripe lists newest first
        if after:
            ids = [c["id"] for c in charges]
            charges = charges[ids.index(after) + 1:] if after in ids else []
        page = charges[:limit]
        return httpx.Response(200, json={"object": "list", "data": page, "has_more": len(charges) > limit,
                                         "url": "/v1/charges"})

    return httpx.Client(transport=httpx.MockTransport(handle))
