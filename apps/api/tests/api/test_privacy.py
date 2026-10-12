"""Spec section 4: no public endpoint may expose raw borrower revenue, payments or receipts."""

import json

from sqlmodel import Session, select

from credent.models import PrivatePayment, PrivateSeries
from tests.api.conftest import login


def numbers_in(obj, out: set[int]) -> set[int]:
    """Collect every integer appearing as a JSON value or as a whole numeric string."""
    if isinstance(obj, bool):
        return out
    if isinstance(obj, int):
        out.add(obj)
    elif isinstance(obj, str) and obj.isdigit():
        out.add(int(obj))
    elif isinstance(obj, dict):
        for v in obj.values():
            numbers_in(v, out)
    elif isinstance(obj, list):
        for v in obj:
            numbers_in(v, out)
    return out


def test_public_surface_has_no_private_values(seeded, app):
    h = login(seeded)
    rows = seeded.get("/borrower/sample-receipts?profile=saas", headers=h).json()
    seeded.post("/borrower/sources/receipts", headers=h, data={"profile": "saas"},
                files={"file": ("r.json", json.dumps(rows), "application/json")})
    seeded.post("/borrower/attest", headers=h)
    seeded.post("/sim/advance", json={"days": 35})

    with Session(app.state.engine) as s:
        private: set[int] = set()
        for p in s.exec(select(PrivatePayment)):
            private.add(p.amount)
        texts: list[str] = []
        for ser in s.exec(select(PrivateSeries)):
            private.update(json.loads(ser.daily_json))
            private.add(ser.total)
            texts += [ser.salt, ser.account_ref]
    private = {v for v in private if v > 1000}
    receipt_ids = [r["id"] for r in rows]

    bodies = []
    for path in ["/public/status", "/public/pool", "/public/tranches/history", "/public/loans",
                 "/public/ledger?limit=5000", "/public/blocks", "/public/ledger/verify", "/public/profiles"]:
        r = seeded.get(path)
        assert r.status_code == 200, path
        bodies.append(r.json())
    for loan in seeded.get("/public/loans").json():
        bodies.append(seeded.get(f"/public/loans/{loan['id']}").json())
        if loan["proof_id"]:
            bodies.append(seeded.get(f"/public/proofs/{loan['proof_id']}").json())

    public_numbers = numbers_in(bodies, set())
    leaked = private & public_numbers
    assert not leaked, f"private values exposed publicly: {sorted(leaked)[:10]}"
    blob = json.dumps(bodies)
    for secret in receipt_ids + texts:
        assert secret not in blob, f"leaked: {secret}"
