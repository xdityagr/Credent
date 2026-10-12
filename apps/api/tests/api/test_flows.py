"""Real user journeys over HTTP, with a real Solana keypair signing wallet-link messages and deposit transactions."""

import base64

import base58
from solders.keypair import Keypair
from solders.transaction import Transaction

from credent.services import sim
from tests.api.conftest import Client
from tests.conftest import last_link

PW = "Correct-Horse-9"


def register(client: Client, db, email: str, kind: str, name: str) -> dict:
    assert client.post("/auth/signup", json={"email": email, "password": PW, "name": "Pat Doe"}).status_code == 201
    r = client.post("/auth/verify-email", json={"token": last_link(db, "/verify-email")})
    assert r.status_code == 200 and r.json()["onboarding"]["step"] == "role"
    r = client.post("/orgs", json={"kind": kind, "name": name, "website": "example.com", "sector": "SaaS",
                                   "country": "IN", "description": "Test org"})
    assert r.status_code == 201, r.text
    return r.json()


def link_wallet(client: Client) -> Keypair:
    kp = Keypair()
    addr = str(kp.pubkey())
    msg = client.post("/wallets/challenge", json={"address": addr}).json()["message"]
    sig = base58.b58encode(bytes(kp.sign_message(msg.encode()))).decode()
    r = client.post("/wallets/verify", json={"address": addr, "signature": sig})
    assert r.status_code == 200 and r.json()["is_primary"]
    return kp


def test_csrf_header_required(app):
    from fastapi.testclient import TestClient

    with TestClient(app) as raw:
        r = raw.post("/auth/signup", json={"email": "a@b.io", "password": PW, "name": "A"})
        assert r.status_code == 403 and r.json()["code"] == "CSRF"


def test_signup_login_logout(client, db):
    client.post("/auth/signup", json={"email": "ada@x.io", "password": PW, "name": "Ada"})
    r = client.post("/auth/login", json={"email": "ada@x.io", "password": PW})
    assert r.status_code == 403 and r.json()["code"] == "EMAIL_NOT_VERIFIED"
    client.post("/auth/verify-email", json={"token": last_link(db, "/verify-email")})
    client.post("/auth/logout")
    assert client.get("/me").status_code == 401
    r = client.post("/auth/login", json={"email": "ada@x.io", "password": PW})
    assert r.status_code == 200 and client.get("/me").json()["user"]["email"] == "ada@x.io"
    assert client.cookies.get("credent_session")
    r = client.post("/auth/login", json={"email": "ada@x.io", "password": "Nope-Nope-1"})
    assert r.status_code == 401


def test_lender_creates_pool_and_funds_it_with_a_signed_transaction(client, db):
    register(client, db, "lp@harbor.io", "LENDER", "Harbor Test Capital")
    kp = link_wallet(client)
    assert client.get("/me").json()["onboarding"]["step"] == "done"
    assert client.post("/chain/faucet").status_code == 200
    assert client.get("/chain/balance").json()["cusd"] == 250_000_00

    pool = client.post("/lender/pools", json={"name": "Test Fund", "target_size": 1_000_000_00,
                                             "min_first_loss": 100_000_00, "auto_approve": True}).json()
    assert pool["status"] == "DRAFT"
    assert client.post(f"/lender/pools/{pool['id']}/open").json()["code"] == "POOL_NOT_OPEN"
    assert client.post(f"/lender/pools/{pool['id']}/fund").json()["status"] == "FUNDING"

    prep = client.post(f"/lender/pools/{pool['id']}/deposits/prepare", json={"tranche": "junior", "amount": 150_000_00}).json()
    assert prep["needs_signature"] is True
    tx = Transaction.from_bytes(base64.b64decode(prep["tx_b64"]))
    tx.partial_sign([kp], tx.message.recent_blockhash)  # what Phantom's signTransaction does
    r = client.post(f"/lender/deposits/{prep['intent_id']}/submit",
                    json={"signed_tx_b64": base64.b64encode(bytes(tx)).decode()})
    assert r.status_code == 200 and r.json()["status"] == "CONFIRMED", r.text
    assert client.get("/chain/balance").json()["cusd"] == 100_000_00

    opened = client.post(f"/lender/pools/{pool['id']}/open").json()
    assert opened["status"] == "OPEN" and opened["junior"]["nav"] == 150_000_00
    assert client.get("/public/pools").json()[0]["slug"] == "test-fund"


def test_tampered_signed_deposit_rejected(client, db):
    register(client, db, "lp2@x.io", "LENDER", "Tamper Capital")
    kp = link_wallet(client)
    client.post("/chain/faucet")
    pool = client.post("/lender/pools", json={"name": "T", "target_size": 1_000_000_00}).json()
    client.post(f"/lender/pools/{pool['id']}/fund")
    prep = client.post(f"/lender/pools/{pool['id']}/deposits/prepare", json={"tranche": "junior", "amount": 1_000_00}).json()
    other = client.post(f"/lender/pools/{pool['id']}/deposits/prepare", json={"tranche": "junior", "amount": 2_000_00}).json()
    tx = Transaction.from_bytes(base64.b64decode(other["tx_b64"]))
    tx.partial_sign([kp], tx.message.recent_blockhash)
    r = client.post(f"/lender/deposits/{prep['intent_id']}/submit",
                    json={"signed_tx_b64": base64.b64encode(bytes(tx)).decode()})
    assert r.status_code == 502 and "altered" in r.json()["message"]


def test_borrower_end_to_end_with_custodial_wallet(client, db, ctx):
    # a lender pool to apply to
    register(client, db, "mgr@x.io", "LENDER", "Auto Capital")
    client.post("/wallets/custodial")
    client.post("/chain/faucet")
    pool = client.post("/lender/pools", json={"name": "Auto Fund", "target_size": 1_000_000_00, "advance_bps": 4000,
                                             "auto_approve": True, "auto_approve_max": 500_000_00}).json()
    client.post(f"/lender/pools/{pool['id']}/fund")
    prep = client.post(f"/lender/pools/{pool['id']}/deposits/prepare", json={"tranche": "junior", "amount": 240_000_00}).json()
    assert prep["needs_signature"] is False
    assert client.post(f"/lender/deposits/{prep['intent_id']}/submit", json={}).json()["status"] == "CONFIRMED"
    client.post(f"/lender/pools/{pool['id']}/open")
    client.post("/auth/logout")

    register(client, db, "cfo@fjord.io", "BORROWER", "Fjord Coffee")
    client.post("/wallets/custodial")
    src = client.post("/borrower/sources/demo", json={"profile": "saas"}).json()
    assert src["series"]["total"] > 0
    proof = client.post("/borrower/proofs", json={"source_id": src["id"],
                                                  "threshold": src["series"]["suggested_threshold"]}).json()
    amount = proof["threshold"] * 40 // 100 // 100_00 * 100_00
    app_ = client.post("/borrower/applications", json={"pool_id": pool["id"], "proof_id": proof["id"], "amount": amount})
    assert app_.status_code == 201 and app_.json()["status"] == "APPROVED", app_.text
    app_id = app_.json()["id"]
    assert "Credent loan agreement" in client.get(f"/borrower/applications/{app_id}/terms").json()["message"]
    loan = client.post(f"/borrower/applications/{app_id}/accept", json={}).json()
    assert loan["principal"] == amount and loan["drawdown"]["status"] == "CONFIRMED"
    assert client.get("/chain/balance").json()["cusd"] == amount
    ov = client.get("/borrower/overview").json()
    assert ov["active_loan"]["id"] == loan["id"] and ov["checklist"]["loan"]

    # the lender cannot see the borrower's private loan view, the borrower cannot use lender routes
    assert client.get("/lender/portfolio").status_code == 403


def test_sim_routes_need_a_demo_org(client, db, app, ctx):
    register(client, db, "real@x.io", "BORROWER", "Real Co")
    assert client.post("/sim/advance", json={"days": 1}).status_code == 403
    sim.reset(app.state.engine, ctx, warmup_days=0)
    client.cookies.clear()
    me = client.post("/auth/demo", json={"role": "lender"}).json()
    assert me["org"]["is_demo"] and me["org"]["kind"] == "LENDER"
    assert client.post("/sim/advance", json={"days": 2}).status_code == 200
    assert client.get("/lender/overview").json()["pools"]
    review = client.get("/lender/applications").json()
    assert all("track_record" in a["borrower"] for a in review)
