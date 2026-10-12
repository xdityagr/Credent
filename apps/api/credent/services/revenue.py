"""Borrower revenue sources → notarised commitment → zero-knowledge proof.

Raw revenue lives only in `PrivateSeries`/`PrivatePayment`. Ledger payloads are built from public fields.
"""

import base64
import hashlib
import json
import secrets

from sqlmodel import Session, col, select

from credent import ledger
from credent.auth.security import now
from credent.errors import InvalidAmount, NotFound, ProofInvalid, ProofMismatch, StepOutOfOrder
from credent.models import AttestationRow, Organization, PrivateSeries, ProofRow, RevenueSource
from credent.notary import Attestation, attest as notary_attest, verify_attestation
from credent.services import audit, clock
from credent.services.context import Ctx
from credent.sources.profiles import PROFILES, daily_revenue
from credent.sources.receipts import make_receipts, parse_receipts
from credent.terms import HISTORY_DAYS, THRESHOLD_STEP
from credent.zk.encode import parse_public_inputs
from credent.zk.prover import ProofArtifacts, Prover, new_salt

PROOF_VALID_DAYS = 30
KIND_LABEL = {"DEMO": "Demo business", "STRIPE": "Stripe", "RECEIPTS": "Signed receipts"}
NOTARY_SOURCE = {"DEMO": "demo-zktls-sim", "STRIPE": "stripe-api", "RECEIPTS": "receipts"}


def _h(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def period(s: Session) -> tuple[int, int]:
    end = clock.today(s)
    return end - HISTORY_DAYS, end


def suggest(total: int) -> int:
    return max(THRESHOLD_STEP, total // THRESHOLD_STEP * THRESHOLD_STEP) if total >= THRESHOLD_STEP else total


def _store(s: Session, org: Organization, src: RevenueSource, account_ref: str, daily: list[int]) -> PrivateSeries:
    start, end = period(s)
    row = s.get(PrivateSeries, src.id) or PrivateSeries(source_id=src.id, org_id=org.id, account_ref="",
                                                        daily_json="[]", salt="0", total=0,
                                                        period_start=start, period_end=end)
    row.account_ref, row.daily_json, row.salt, row.total = account_ref, json.dumps(daily), new_salt(), sum(daily)
    row.period_start, row.period_end = start, end
    s.add(row)
    return row


def connect_demo(s: Session, org: Organization, profile: str) -> RevenueSource:
    if profile not in PROFILES:
        raise InvalidAmount(f"Unknown demo business '{profile}'.")
    src = RevenueSource(org_id=org.id, kind="DEMO", label=PROFILES[profile].label, profile=profile,
                        seed=secrets.randbits(62))
    s.add(src)
    s.flush()
    start, _ = period(s)
    _store(s, org, src, f"demo:{src.seed:x}", daily_revenue(PROFILES[profile], src.seed, start, HISTORY_DAYS))
    audit.log(s, None, org.id, "revenue.connect", "DEMO", profile=profile)
    return src


def sample_receipts(s: Session, ctx: Ctx, profile: str, tampered: bool) -> list[dict]:
    if profile not in PROFILES:
        raise InvalidAmount(f"Unknown business profile '{profile}'.")
    start, _ = period(s)
    series = daily_revenue(PROFILES[profile], secrets.randbits(62), start, HISTORY_DAYS)
    return make_receipts(series, start, ctx.keys.get("processor"), tampered=tampered)


def processor_pubkey(ctx: Ctx) -> str:
    from credent.crypto.keys import pubkey_b58

    return pubkey_b58(ctx.keys.get("processor"))


def connect_receipts(s: Session, ctx: Ctx, org: Organization, rows: list[dict], label: str = "Signed receipts") -> RevenueSource:
    start, _ = period(s)
    daily = parse_receipts(rows, processor_pubkey(ctx), start, HISTORY_DAYS)  # validates before any write
    src = RevenueSource(org_id=org.id, kind="RECEIPTS", label=label[:60] or "Signed receipts")
    s.add(src)
    s.flush()
    _store(s, org, src, "receipts:" + _h(",".join(sorted(str(r["id"]) for r in rows))), daily)
    audit.log(s, None, org.id, "revenue.connect", "RECEIPTS")
    return src


def connect_series(s: Session, org: Organization, kind: str, label: str, account_ref: str, daily: list[int],
                   **fields) -> RevenueSource:
    """Used by the Stripe connector once it has bucketed charges into 90 daily totals."""
    src = RevenueSource(org_id=org.id, kind=kind, label=label, **fields)
    s.add(src)
    s.flush()
    _store(s, org, src, account_ref, daily)
    return src


def sources(s: Session, org: Organization) -> list[RevenueSource]:
    return list(s.exec(select(RevenueSource).where(RevenueSource.org_id == org.id, RevenueSource.status == "ACTIVE")
                       .order_by(col(RevenueSource.created).desc())))


def get_source(s: Session, org: Organization, source_id: str) -> RevenueSource:
    src = s.get(RevenueSource, source_id)
    if src is None or src.org_id != org.id or src.status != "ACTIVE":
        raise NotFound("Revenue source not found.")
    return src


def disconnect(s: Session, org: Organization, source_id: str) -> None:
    src = get_source(s, org, source_id)
    src.status, src.stripe_key_enc = "DISCONNECTED", None
    s.add(src)


def series(s: Session, src: RevenueSource) -> PrivateSeries:
    row = s.get(PrivateSeries, src.id)
    if row is None:
        raise StepOutOfOrder("This source has no revenue history yet.")
    return row


def series_view(row: PrivateSeries) -> dict:
    return {"period_start": row.period_start, "period_end": row.period_end, "daily": json.loads(row.daily_json),
            "total": row.total, "suggested_threshold": suggest(row.total)}


def latest_attestation(s: Session, src: RevenueSource) -> AttestationRow | None:
    return s.exec(select(AttestationRow).where(AttestationRow.source_id == src.id)
                  .order_by(col(AttestationRow.created).desc())).first()


def attest(s: Session, ctx: Ctx, org: Organization, src: RevenueSource) -> AttestationRow:
    row = series(s, src)
    commitment = ctx.prover.commit(json.loads(row.daily_json), row.salt)
    a = notary_attest(NOTARY_SOURCE[src.kind], row.period_start, row.period_end, row.account_ref,
                      commitment, ctx.keys.get("notary"), account_salt=row.salt)
    att = AttestationRow(**a.__dict__, org_id=org.id, source_id=src.id, borrower_id=org.pseudonym, day=clock.today(s))
    s.merge(att)
    ledger.append(s, att.day, "AttestationRecorded", {
        "attestation_id": a.id, "borrower": org.pseudonym, "source": a.source, "period_start": a.period_start,
        "period_end": a.period_end, "account_hash": a.account_hash, "commitment": a.commitment,
        "notary_pubkey": a.notary_pubkey, "signature": a.signature})
    return att


def to_attestation(row: AttestationRow) -> Attestation:
    return Attestation(id=row.id, source=row.source, period_start=row.period_start, period_end=row.period_end,
                       account_hash=row.account_hash, commitment=row.commitment, notary_pubkey=row.notary_pubkey,
                       signature=row.signature)


def check_proof(att: AttestationRow, art: ProofArtifacts, threshold: int, prover: Prover) -> None:
    if not verify_attestation(to_attestation(att)):
        raise ProofInvalid("Notary signature on the attestation is invalid.")
    if not prover.verify(art):
        raise ProofInvalid("The zero-knowledge proof did not verify.")
    pi_threshold, pi_commitment = parse_public_inputs(base64.b64decode(art.public_inputs_b64))
    if pi_threshold != threshold:
        raise ProofMismatch("Proof threshold differs from the claimed threshold.")
    if pi_commitment != att.commitment:
        raise ProofMismatch("Proof commitment differs from the notarised commitment.")


def prove(s: Session, ctx: Ctx, org: Organization, src: RevenueSource, threshold: int) -> ProofRow:
    if not isinstance(threshold, int) or threshold <= 0:
        raise InvalidAmount("Threshold must be a positive amount.")
    att = latest_attestation(s, src)
    if att is None:
        att = attest(s, ctx, org, src)
    row = series(s, src)
    art = ctx.prover.prove(json.loads(row.daily_json), row.salt, threshold)
    check_proof(att, art, threshold, ctx.prover)
    today = clock.today(s)
    proof = ProofRow(id="prf_" + _h(art.proof_b64)[:16], org_id=org.id, borrower_id=org.pseudonym, source_id=src.id,
                     attestation_id=att.id, threshold=threshold, commitment=att.commitment, proof_b64=art.proof_b64,
                     public_inputs_b64=art.public_inputs_b64, vk_b64=art.vk_b64, verified=True,
                     timings_json=json.dumps(art.timings_ms), day=today, expires_day=today + PROOF_VALID_DAYS)
    s.merge(proof)
    ledger.append(s, today, "ProofVerified", {
        "proof_id": proof.id, "borrower": org.pseudonym, "attestation_id": att.id,
        "claim": "sum(daily_revenue[90d]) >= threshold", "threshold": threshold, "commitment": att.commitment,
        "vk_hash": _h(art.vk_b64)})
    audit.log(s, None, org.id, "proof.created", proof.id, threshold=threshold)
    return proof


def proofs(s: Session, org: Organization) -> list[ProofRow]:
    return list(s.exec(select(ProofRow).where(ProofRow.org_id == org.id).order_by(col(ProofRow.created).desc())))


def proof_view(s: Session, p: ProofRow) -> dict:
    today = clock.today(s)
    src = s.get(RevenueSource, p.source_id)
    return {"id": p.id, "threshold": p.threshold, "commitment": p.commitment, "day": p.day,
            "date": clock.iso_date(s, p.day), "expires_day": p.expires_day,
            "expires_date": clock.iso_date(s, p.expires_day), "expired": today > p.expires_day,
            "source": {"id": src.id, "kind": src.kind, "label": src.label} if src else None,
            "timings_ms": json.loads(p.timings_json)}


def source_view(s: Session, src: RevenueSource) -> dict:
    row = s.get(PrivateSeries, src.id)
    att = latest_attestation(s, src)
    return {"id": src.id, "kind": src.kind, "kind_label": KIND_LABEL[src.kind], "label": src.label,
            "profile": src.profile, "connected_at": src.connected_at.isoformat(),
            "last_polled_at": src.last_polled_at.isoformat() if src.last_polled_at else None,
            "series": series_view(row) if row else None,
            "attestation": {"id": att.id, "commitment": att.commitment, "date": clock.iso_date(s, att.day)} if att else None}


# ---------------------------------------------------------------- Stripe (test mode)

def _master(ctx: Ctx) -> bytes:
    return bytes(ctx.keys.get("custody-master"))


def connect_stripe(s: Session, ctx: Ctx, org: Organization, key: str, http=None) -> RevenueSource:
    from datetime import timedelta

    from credent.sources import stripe

    key = stripe.check_key(key)
    start, _ = period(s)
    day_of = stripe.ts_to_day(clock.state(s).genesis, clock.LAUNCH_DAY)
    since = int((clock.date_of(s, start) - timedelta(days=1)).timestamp())
    charges = stripe.charges_since(key, since, http)
    daily = stripe.bucket(charges, day_of, start, HISTORY_DAYS)
    cursor = max((int(c["created"]) for c in charges), default=since)
    src = connect_series(s, org, "STRIPE", "Stripe (test mode)", stripe.account_ref(key), daily,
                         stripe_key_enc=stripe.encrypt(_master(ctx), key), stripe_account_hash=stripe.account_ref(key),
                         cursor=cursor)
    audit.log(s, None, org.id, "revenue.connect", "STRIPE", charges=len(charges))
    return src


def poll_stripe(s: Session, ctx: Ctx, src: RevenueSource, http=None) -> int:
    """Ingest charges created since the last poll into the lockbox. Returns how many were new."""
    from credent.services import collections
    from credent.sources import stripe

    if src.kind != "STRIPE" or not src.stripe_key_enc:
        return 0
    key = stripe.decrypt(_master(ctx), src.stripe_key_enc)
    charges = stripe.charges_since(key, (src.cursor or 0) + 1, http)
    n = 0
    for c in sorted(charges, key=lambda c: c["created"]):
        amount = stripe.net_usd(c)
        if amount > 0:
            collections.ingest(s, src.org_id, amount, f"stripe:{c['id']}", src.id)
            n += 1
        src.cursor = max(src.cursor or 0, int(c["created"]))
    src.last_polled_at = now()
    s.add(src)
    return n
