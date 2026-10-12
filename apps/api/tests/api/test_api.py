import base58
from nacl.signing import SigningKey

from credent.errors import ProverUnavailable
from tests.api.conftest import login


def test_health_and_status(client):
    assert client.get("/health").json() == {"ok": True}
    st = client.get("/public/status").json()
    assert st["seeded"] is False and st["prover"]["ok"] is True
    assert st["anchor"]["enabled"] is False


def test_wallet_signin(client):
    key = SigningKey.generate()
    wallet = base58.b58encode(bytes(key.verify_key)).decode()
    msg = client.post("/auth/challenge", json={"wallet": wallet}).json()["message"]
    sig = base58.b58encode(key.sign(msg.encode()).signature).decode()
    r = client.post("/auth/verify", json={"wallet": wallet, "signature": sig})
    assert r.status_code == 200
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"}).json()
    assert me == {"wallet": wallet, "borrower_id": None}


def test_unauthenticated_borrower_route(client):
    r = client.post("/borrower/attest")
    assert r.status_code == 401 and r.json()["code"] == "UNAUTHORIZED"


def test_full_borrower_flow(seeded):
    h = login(seeded)
    view = seeded.post("/borrower/sources/stripe", json={"profile": "saas"}, headers=h).json()
    att = seeded.post("/borrower/attest", headers=h).json()
    assert att["commitment"].startswith("0x")
    pr = seeded.post("/borrower/prove", json={"threshold": view["suggested_threshold"]}, headers=h).json()
    assert pr["timings_ms"]
    line = seeded.post("/borrower/credit-line", headers=h).json()
    r = seeded.post("/borrower/draw", json={"amount": line["limit"] + 1}, headers=h)
    assert r.status_code == 400 and r.json()["code"] == "CREDIT_EXCEEDED"
    loan = seeded.post("/borrower/draw", json={"amount": line["limit"]}, headers=h).json()
    me = seeded.get("/borrower/me", headers=h).json()
    assert me["loan"]["id"] == loan["id"] and me["series"]["total"] == view["total"]
    pub = seeded.get(f"/public/loans/{loan['id']}").json()
    assert pub["threshold"] == view["suggested_threshold"]
    assert [e["type"] for e in pub["events"]] == ["LoanDrawn"]
    v = seeded.post(f"/public/proofs/{pr['proof_id']}/verify").json()
    assert v["valid"] is True


def test_receipts_upload_and_tamper(seeded):
    h = login(seeded)
    good = seeded.get("/borrower/sample-receipts?profile=ecommerce", headers=h)
    bad = seeded.get("/borrower/sample-receipts?profile=ecommerce&tampered=true", headers=h)
    r = seeded.post("/borrower/sources/receipts", headers=h, data={"profile": "ecommerce"},
                    files={"file": ("bad.json", bad.content, "application/json")})
    assert r.status_code == 400 and r.json()["code"] == "RECEIPT_INVALID"
    r = seeded.post("/borrower/sources/receipts", headers=h, data={"profile": "ecommerce"},
                    files={"file": ("good.json", good.content, "application/json")})
    assert r.status_code == 200 and r.json()["source"] == "receipts"


def test_lender_flow_and_subordination(seeded):
    h = login(seeded)
    assert seeded.post("/lender/deposit", json={"tranche": "junior", "amount": 100}, headers=h).json()["code"] == "INSUFFICIENT_BALANCE"
    seeded.post("/lender/faucet", headers=h)
    pos = seeded.post("/lender/deposit", json={"tranche": "junior", "amount": 50_000_00}, headers=h).json()
    assert pos["positions"][0]["value"] == 50_000_00
    room = seeded.get("/public/pool").json()["subordination_room"]
    for _ in range(room // 250_000_00 + 2):
        seeded.post("/lender/faucet", headers=h)
    r = seeded.post("/lender/deposit", json={"tranche": "senior", "amount": room + 1}, headers=h)
    assert r.status_code == 409 and r.json()["code"] == "SUBORDINATION_BREACH"


def test_sim_and_public_views(seeded):
    start = seeded.get("/public/status").json()["day"]
    assert start == 90 + 28  # reset seeds then warms up four weeks
    assert seeded.post("/sim/advance", json={"days": 56}).json()["day"] == start + 56
    pool = seeded.get("/public/pool").json()
    assert pool["loans_defaulted"] == 1 and pool["total_losses"] > 0
    assert pool["senior"]["writedown"] == 0
    loans = seeded.get("/public/loans").json()
    defaulted = next(l for l in loans if l["status"] == "DEFAULTED")
    seeded.post("/sim/recover", json={"loan_id": defaulted["id"], "amount": 10_000_00})
    assert seeded.get("/public/pool").json()["total_recovered"] == 10_000_00
    assert seeded.get("/public/ledger/verify").json()["ok"] is True
    blocks = seeded.get("/public/blocks").json()
    assert blocks and blocks[0]["memo"].startswith("credent:v1:block:")
    assert len(seeded.get("/public/tranches/history").json()) >= 8
    newest = seeded.get("/public/ledger?limit=5").json()
    assert newest[0]["seq"] > newest[-1]["seq"]
    after = seeded.get(f"/public/ledger?after={newest[-1]['seq']}").json()
    assert after[0]["seq"] == newest[-1]["seq"] + 1


def test_validation_errors_are_shaped(seeded):
    r = seeded.post("/sim/advance", json={"days": 0})
    assert r.status_code == 422 and r.json()["code"] == "INVALID_REQUEST"
    r = seeded.get("/public/loans/LN-9999")
    assert r.status_code == 404 and r.json()["code"] == "NOT_FOUND"


def test_prover_unavailable_maps_to_503(seeded, app):
    def boom():
        raise ProverUnavailable("docker is off")
    app.state.ctx.prover.ensure_available = boom
    app.state.ctx.prover.commit = lambda *a: boom()
    h = login(seeded)
    seeded.post("/borrower/sources/stripe", json={"profile": "saas"}, headers=h)
    r = seeded.post("/borrower/attest", headers=h)
    assert r.status_code == 503 and r.json() == {"code": "PROVER_UNAVAILABLE", "message": "docker is off"}
    assert seeded.get("/public/status").json()["prover"] == {"ok": False, "message": "docker is off"}
