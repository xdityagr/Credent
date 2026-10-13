"""Stripe test-mode connector against recorded API responses."""

from datetime import timedelta

import httpx
import pytest
from sqlmodel import select

from credent.models import PrivatePayment
from credent.services import accounts, clock, orgs, revenue
from credent.sources import stripe
from tests.conftest import last_link

PW = "Correct-Horse-9"


def charge(cid, ts, amount, refunded=0, status="succeeded", currency="usd"):
    return {"id": cid, "created": ts, "amount": amount, "amount_refunded": refunded, "status": status,
            "currency": currency, "paid": True}


def fake_stripe(pages: list[list[dict]], seen: list):
    def handle(req: httpx.Request) -> httpx.Response:
        seen.append(dict(req.url.params))
        assert req.headers["Authorization"].startswith("Bearer rk_test_")
        idx = 1 if "starting_after" in req.url.params else 0
        data = pages[idx] if idx < len(pages) else []
        return httpx.Response(200, json={"data": data, "has_more": idx + 1 < len(pages)})
    return httpx.Client(transport=httpx.MockTransport(handle))


@pytest.fixture
def borrower(session, settings):
    u = accounts.signup(session, settings, "f@x.io", PW, "F")
    accounts.verify_email(session, last_link(session, "/verify-email"))
    return orgs.create(session, u, "BORROWER", {"name": "Fjord Coffee"})


def test_rejects_live_keys():
    with pytest.raises(stripe.StripeError):
        stripe.check_key("sk_live_123")


def test_connect_buckets_net_usd_by_day(session, ctx, borrower):
    clock.state(session)
    day_ts = lambda d: int((clock.date_of(session, d) + timedelta(hours=12)).timestamp())  # noqa: E731
    today = clock.today(session)
    page1 = [charge("ch_1", day_ts(today - 1), 120_00), charge("ch_2", day_ts(today - 1), 50_00, refunded=20_00),
             charge("ch_3", day_ts(today - 30), 999_00, status="failed")]
    page2 = [charge("ch_4", day_ts(today - 89), 75_00), charge("ch_5", day_ts(today - 5), 10_00, currency="eur"),
             charge("ch_old", day_ts(today - 200), 5_000_00)]
    seen = []
    src = revenue.connect_stripe(session, ctx, borrower, "rk_test_abc", fake_stripe([page1, page2], seen))
    view = revenue.series_view(revenue.series(session, src))
    assert view["daily"][-1] == 120_00 + 30_00
    assert view["daily"][1] == 75_00  # window starts at today-90
    assert view["total"] == 225_00
    assert "rk_test_abc" not in src.stripe_key_enc
    assert stripe.decrypt(bytes(ctx.keys.get("custody-master")), src.stripe_key_enc) == "rk_test_abc"
    assert len(seen) == 2 and "starting_after" in seen[1]


def test_poll_ingests_new_charges_once(session, ctx, borrower):
    clock.state(session)
    src = revenue.connect_stripe(session, ctx, borrower, "rk_test_abc", fake_stripe([[]], []))
    new = [charge("ch_9", (src.cursor or 0) + 10, 300_00)]
    assert revenue.poll_stripe(session, ctx, src, fake_stripe([new], [])) == 1
    revenue.poll_stripe(session, ctx, src, fake_stripe([new], []))  # replay is idempotent
    pays = session.exec(select(PrivatePayment)).all()
    assert len(pays) == 1 and pays[0].external_ref == "stripe:ch_9" and pays[0].released == 300_00


# ---------------- sandbox account ----------------
from credent.sources import stripe_sandbox  # noqa: E402


def test_sandbox_account_connects_with_90_days(session, ctx, borrower):
    clock.state(session)
    key = stripe_sandbox.new_key("saas")
    src = revenue.connect_stripe(session, ctx, borrower, key)
    view = revenue.series_view(revenue.series(session, src))
    assert src.label == "Stripe sandbox"
    assert view["total"] > 0 and sum(1 for d in view["daily"] if d > 0) >= 85
    charges = revenue.recent_charges(session, ctx, src, 50)
    assert charges and charges[0]["created"] >= charges[-1]["created"]  # newest first
    assert all(c["invoice"] or c["status"] == "failed" for c in charges)
    assert {"customer", "description", "amount", "status"} <= set(charges[0])


def test_sandbox_net_revenue_excludes_failures_and_refunds(session, ctx, borrower):
    clock.state(session)
    key = stripe_sandbox.new_key("ecommerce")
    src = revenue.connect_stripe(session, ctx, borrower, key)
    row = revenue.series(session, src)
    st = clock.state(session)
    day0 = clock.today(session) - 90
    expected = 0
    for d in range(day0, clock.today(session)):
        for c in stripe_sandbox.charges_for_day(key, d, clock.date_of(session, d)):
            expected += stripe.net_usd(c)
    assert row.total == expected and st


def test_sandbox_poll_ingests_new_days_once(session, ctx, borrower):
    st = clock.state(session)
    src = revenue.connect_stripe(session, ctx, borrower, stripe_sandbox.new_key("saas"))
    assert revenue.poll_stripe(session, ctx, src) == 0  # nothing new yet
    st.day += 2
    session.add(st)
    n = revenue.poll_stripe(session, ctx, src)
    assert n > 0
    assert revenue.poll_stripe(session, ctx, src) == 0
    assert len(session.exec(select(PrivatePayment)).all()) == n
