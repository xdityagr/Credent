"""No public route may expose private revenue, payments, receipts, or borrower identities."""

import json

from sqlmodel import select

from credent.models import Organization, PrivatePayment, PrivateSeries, User
from credent.services import sim


def numbers_in(obj, out: set[int]) -> set[int]:
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


def test_public_surface_has_no_private_data(client, app, ctx, db):
    sim.reset(app.state.engine, ctx, warmup_days=0)
    sim.advance(db, ctx, 56)

    private: set[int] = set()
    secrets: list[str] = []
    for p in db.exec(select(PrivatePayment)):
        private |= {p.amount, p.released}
    for ser in db.exec(select(PrivateSeries)):
        private |= set(json.loads(ser.daily_json)) | {ser.total}
        secrets += [ser.salt, ser.account_ref]
    for o in db.exec(select(Organization).where(Organization.kind == "BORROWER")):
        secrets += [o.name, o.slug, o.website, o.description]
    secrets += [u.email for u in db.exec(select(User))]
    private = {v for v in private if v > 1000}

    bodies = []
    paths = ["/public/status", "/public/stats", "/public/pools", "/public/loans", "/public/ledger?limit=1000",
             "/public/ledger/verify", "/public/blocks", "/public/profiles"]
    for pool in client.get("/public/pools").json():
        paths += [f"/public/pools/{pool['slug']}", f"/orgs/{pool['manager']['slug']}"]
    for loan in client.get("/public/loans").json():
        paths.append(f"/public/loans/{loan['id']}")
        if loan["proof_id"]:
            paths.append(f"/public/proofs/{loan['proof_id']}")
    for path in paths:
        r = client.get(path)
        assert r.status_code == 200, path
        bodies.append(r.json())
    # borrower organisations have no public profile
    for o in db.exec(select(Organization).where(Organization.kind == "BORROWER")):
        assert client.get(f"/orgs/{o.slug}").status_code == 404

    leaked = private & numbers_in(bodies, set())
    assert not leaked, f"private values exposed: {sorted(leaked)[:10]}"
    blob = json.dumps(bodies)
    for secret in secrets:
        if secret:
            assert secret not in blob, f"leaked: {secret}"
