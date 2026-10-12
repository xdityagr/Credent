"""Regression tests for the v2 security/money review."""

import json

from sqlmodel import Session, select

from credent.chain import spl
from credent.chain.client import ChainError
from credent.models import Application, ChainTransfer, LedgerEvent, LoanRow, Organization, Pool, User
from credent.services import clock, settlement, sim, transfers
from tests.api.test_flows import register


def seeded(app, ctx):
    sim.reset(app.state.engine, ctx, warmup_days=0)


# C1: demo sessions must not be able to touch real organisations or wipe the database.
def test_demo_cannot_reset_or_touch_real_orgs(client, app, ctx, db):
    seeded(app, ctx)
    register(client, db, "real@x.io", "BORROWER", "Real Co")  # a real organisation joins
    client.cookies.clear()
    assert client.post("/auth/demo", json={"role": "lender"}).status_code == 200
    r = client.post("/sim/reset")
    assert r.status_code == 403
    assert db.exec(select(User).where(User.email == "real@x.io")).first() is not None
    assert client.post("/sim/advance", json={"days": 1}).status_code == 403
    # a loan in a pool the demo lender doesn't manage
    other = db.exec(select(LoanRow)).first()
    real = db.get(Organization, other.borrower_org_id)
    real.is_demo = False  # stands in for a real company's loan
    db.add(real)
    db.commit()
    assert client.post("/sim/default", json={"loan_id": other.id}).status_code == 403
    assert client.post("/sim/recover", json={"loan_id": other.id, "amount": 10**12}).status_code == 403


def test_demo_login_needs_sim_enabled(client, app, ctx):
    seeded(app, ctx)
    ctx.settings.sim_enabled = False
    try:
        assert client.post("/auth/demo", json={"role": "lender"}).status_code == 403
    finally:
        ctx.settings.sim_enabled = True


# I1: a lost send response must not pay twice.
def test_transfer_send_error_after_landing_pays_once(app, ctx, db, monkeypatch):
    seeded(app, ctx)
    chain = ctx.chain(clock.world(db))
    real_send = chain.client.send
    calls = {"n": 0}

    def flaky(tx):
        calls["n"] += 1
        sig = real_send(tx)
        if calls["n"] == 1:
            raise ChainError("timeout after delivery")
        return sig

    before = chain.balance("treasury")
    t = transfers.enqueue(db, "SETTLEMENT", [transfers.Leg("mint", "treasury", spl.to_base(123_00))])
    db.commit()
    monkeypatch.setattr(chain.client, "send", flaky)
    for _ in range(5):
        transfers.process(db, chain)
    db.refresh(t)
    assert t.status == "CONFIRMED"
    assert chain.balance("treasury") - before == spl.to_base(123_00)


# I6: settling the same day twice is a no-op.
def test_settle_week_idempotent(app, ctx, db):
    seeded(app, ctx)
    sim.advance(db, ctx, 9)
    day = (clock.today(db) // 7) * 7
    n = len(db.exec(select(LedgerEvent).where(LedgerEvent.type == "InterestDistributed")).all())
    settlement.settle_week(db, day)
    db.commit()
    assert len(db.exec(select(LedgerEvent).where(LedgerEvent.type == "InterestDistributed")).all()) == n


# I4: simulated revenue can't auto-approve a loan from a real lender's pool.
def test_demo_revenue_not_auto_approved_by_real_pool(client, app, ctx, db):
    register(client, db, "mgr@x.io", "LENDER", "Real Capital")
    client.post("/wallets/custodial")
    client.post("/chain/faucet")
    pool = client.post("/lender/pools", json={"name": "Real Fund", "target_size": 1_000_000_00,
                                             "auto_approve": True, "auto_approve_max": 500_000_00}).json()
    client.post(f"/lender/pools/{pool['id']}/fund")
    prep = client.post(f"/lender/pools/{pool['id']}/deposits/prepare", json={"tranche": "junior", "amount": 240_000_00}).json()
    client.post(f"/lender/deposits/{prep['intent_id']}/submit", json={})
    client.post(f"/lender/pools/{pool['id']}/open")
    client.post("/auth/logout")
    register(client, db, "b@x.io", "BORROWER", "Borrower Co")
    client.post("/wallets/custodial")
    src = client.post("/borrower/sources/demo", json={"profile": "saas"}).json()
    proof = client.post("/borrower/proofs", json={"source_id": src["id"], "threshold": src["series"]["suggested_threshold"]}).json()
    r = client.post("/borrower/applications", json={"pool_id": pool["id"], "proof_id": proof["id"], "amount": 10_000_00})
    assert r.status_code == 201 and r.json()["status"] == "SUBMITTED"
    assert r.json()["proof"]["source_kind"] == "DEMO"


# I8: notification links point at real frontend routes.
def test_notification_links_exist():
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[2] / "credent" / "services"
    text = "".join(p.read_text(encoding="utf-8") for p in root.glob("*.py"))
    assert '"/app/applications/' not in text and "f\"/app/applications/{" not in text
    assert "/app/pools/{p.id}" not in text and "/app/pools/{" not in text


_ = (json, Session, Application, ChainTransfer)
