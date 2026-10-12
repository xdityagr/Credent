"""Public read models. Built only from public fields; never from Private* tables or borrower identities."""

import base64
import hashlib
import json
import time

from sqlmodel import Session, col, func, select

from credent import ledger
from credent.chain.client import explorer_address, explorer_tx
from credent.chain.service import ChainService
from credent.crypto.keys import KeyStore, pubkey_b58
from credent.errors import NotFound
from credent.models import (
    AttestationRow,
    Block,
    ChainTransfer,
    LedgerEvent,
    LoanRow,
    NavSnapshot,
    Organization,
    Pool,
    ProofRow,
    ReserveSnapshot,
)
from credent.services import clock, funds, loans, pools, revenue
from credent.zk.encode import parse_public_inputs
from credent.zk.prover import ProofArtifacts, Prover

CLAIM = "sum(daily_revenue[90d]) >= threshold"


def _manager(s: Session, p: Pool) -> dict:
    o = s.get(Organization, p.manager_org_id)
    return {"name": o.name, "slug": o.slug, "pseudonym": o.pseudonym,
            "logo_url": f"/api/uploads/{o.logo_path}" if o.logo_path else None}


def _tranche(t, coupon: int | None) -> dict:
    return {"nav": t.nav, "shares": t.shares, "price_e6": funds.price_e6(t), "coupon_bps": coupon,
            "coupon_arrears": t.coupon_arrears, "writedown": t.writedown}


def pool_view(s: Session, chain: ChainService, p: Pool) -> dict:
    st = pools.load(p)
    counts = dict(s.exec(select(LoanRow.status, func.count()).where(LoanRow.pool_id == p.id)
                         .group_by(LoanRow.status)).all())
    rs = s.exec(select(ReserveSnapshot).where(ReserveSnapshot.pool_id == p.id)
                .order_by(col(ReserveSnapshot.id).desc())).first()
    return {
        "id": p.id, "slug": p.slug, "name": p.name, "description": p.description, "status": p.status,
        "manager": _manager(s, p), "target_size": p.target_size, "total_nav": st.total_nav, "cash": st.cash,
        "outstanding": st.outstanding, "treasury": st.treasury,
        "utilization_bps": st.outstanding * 10_000 // st.total_nav if st.total_nav else 0,
        "leverage_x100": st.senior.nav * 100 // st.junior.nav if st.junior.nav else 0,
        "subordination_room": max(0, pools.terms(p).senior_cap(st.junior.nav) - st.senior.nav),
        "senior": _tranche(st.senior, p.senior_coupon_bps), "junior": _tranche(st.junior, None),
        "borrower_apr_bps": p.borrower_apr_bps, "advance_bps": p.advance_bps, "term_epochs": p.term_epochs,
        "min_threshold": p.min_threshold, "max_loan": p.max_loan, "max_leverage_x100": p.max_leverage_x100,
        "fee_bps": p.fee_bps, "min_first_loss": p.min_first_loss, "auto_approve": p.auto_approve,
        "loans_active": counts.get("ACTIVE", 0) + counts.get("LATE", 0), "loans_late": counts.get("LATE", 0),
        "loans_repaid": counts.get("REPAID", 0), "loans_defaulted": counts.get("DEFAULTED", 0),
        "reserves": {"ok": rs.ok if rs else None, "onchain": rs.onchain if rs else None,
                     "checked_at": rs.ts.isoformat() if rs else None},
        "vault_address": p.vault_address, "vault_url": explorer_address(p.vault_address, chain.cluster),
        "created_at": p.created_at.isoformat(),
    }


def pools_list(s: Session, chain: ChainService) -> list[dict]:
    return [pool_view(s, chain, p) for p in s.exec(select(Pool).where(Pool.status != "DRAFT")
                                                   .order_by(col(Pool.created)))]


def pool_detail(s: Session, chain: ChainService, slug: str) -> dict:
    p = pools.get(s, slug)
    if p.status == "DRAFT":
        raise NotFound("Pool not found.")
    hist = s.exec(select(NavSnapshot).where(NavSnapshot.pool_id == p.id).order_by(col(NavSnapshot.day))).all()
    return {**pool_view(s, chain, p),
            "nav_history": [{**h.model_dump(exclude={"pool_id"}), "date": clock.iso_date(s, h.day)} for h in hist],
            "loans": [loan_view(s, chain, l) for l in s.exec(select(LoanRow).where(LoanRow.pool_id == p.id)
                                                             .order_by(col(LoanRow.created)))]}


def loan_view(s: Session, chain: ChainService, loan: LoanRow) -> dict:
    st = loans.state(loan)
    p = s.get(Pool, loan.pool_id)
    from credent.models import Application

    app = s.get(Application, loan.application_id)
    proof = s.get(ProofRow, app.proof_id) if app else None
    xfer = s.get(ChainTransfer, loan.drawdown_transfer_id) if loan.drawdown_transfer_id else None
    return {
        "id": loan.id, "pool": {"id": p.id, "slug": p.slug, "name": p.name}, "borrower": loan.borrower_id,
        "principal": loan.principal, "apr_bps": loan.apr_bps, "epochs": loan.epochs,
        "installment": loan.installment, "status": loan.status, "drawn_day": loan.drawn_day,
        "drawn_date": clock.iso_date(s, loan.drawn_day), "epoch": st.epoch, "outstanding": st.outstanding,
        "arrears": st.arrears_interest + st.arrears_principal, "consecutive_short": st.consecutive_short,
        "proof_id": proof.id if proof else None, "threshold": proof.threshold if proof else None,
        "history": st.history,
    }


def loans_list(s: Session, chain: ChainService, pool: str | None = None) -> list[dict]:
    q = select(LoanRow).order_by(col(LoanRow.created))
    if pool:
        q = q.where(LoanRow.pool_id == pools.get(s, pool).id)
    return [loan_view(s, chain, l) for l in s.exec(q)]


def loan_detail(s: Session, chain: ChainService, loan_id: str) -> dict:
    loan = loans.get(s, loan_id)
    evs = []
    for e in s.exec(select(LedgerEvent).where(LedgerEvent.pool_id == loan.pool_id).order_by(col(LedgerEvent.seq))):
        pl = json.loads(e.payload_json)
        if pl.get("loan_id") == loan_id or loan_id in pl.get("loans", []):
            evs.append(event_view(s, chain, e))
    return {**loan_view(s, chain, loan), "events": evs}


def event_view(s: Session, chain: ChainService, e: LedgerEvent) -> dict:
    d = ledger.to_public(e)
    d["date"] = clock.iso_date(s, e.day)
    sig = d["payload"].get("signature")
    d["explorer_url"] = explorer_tx(sig, chain.cluster) if sig else None
    return d


def events(s: Session, chain: ChainService, after: int | None, before: int | None, limit: int,
           type_: str | None, pool: str | None) -> list[dict]:
    q = select(LedgerEvent)
    if pool:
        q = q.where(LedgerEvent.pool_id == pools.get(s, pool).id)
    if type_:
        q = q.where(col(LedgerEvent.type).in_(type_.split(",")))
    if after is not None:
        q = q.where(LedgerEvent.seq > after).order_by(col(LedgerEvent.seq))
    else:
        if before is not None:
            q = q.where(LedgerEvent.seq < before)
        q = q.order_by(col(LedgerEvent.seq).desc())
    return [event_view(s, chain, e) for e in s.exec(q.limit(min(max(limit, 1), 1000)))]


def blocks(s: Session, chain: ChainService) -> list[dict]:
    from credent.anchor import memo_text

    return [{**b.model_dump(exclude={"anchor_error"}), "memo": memo_text(b), "date": clock.iso_date(s, b.day),
             "anchor_url": explorer_tx(b.anchor_sig, chain.cluster) if b.anchor_sig else None}
            for b in s.exec(select(Block).order_by(col(Block.n).desc()).limit(200))]


def verify_chain(s: Session) -> dict:
    ok, bad = ledger.verify_chain(s)
    return {"ok": ok, "bad_seq": bad, "events": s.exec(select(func.count()).select_from(LedgerEvent)).one(),
            "blocks": s.exec(select(func.count()).select_from(Block)).one()}


def stats(s: Session) -> dict:
    nav = outstanding = 0
    n_pools = 0
    for p in s.exec(select(Pool).where(Pool.status != "DRAFT")):
        st = pools.load(p)
        nav += st.total_nav
        outstanding += st.outstanding
        n_pools += 1
    counts = dict(s.exec(select(LoanRow.status, func.count()).group_by(LoanRow.status)).all())
    return {"pools": n_pools, "total_nav": nav, "outstanding": outstanding,
            "loans_active": counts.get("ACTIVE", 0) + counts.get("LATE", 0),
            "loans_repaid": counts.get("REPAID", 0), "loans_defaulted": counts.get("DEFAULTED", 0),
            "proofs_verified": s.exec(select(func.count()).select_from(ProofRow)).one(),
            "ledger_events": s.exec(select(func.count()).select_from(LedgerEvent)).one(),
            "day": clock.today(s), "date": clock.iso_date(s, clock.today(s))}


def proof(s: Session, proof_id: str) -> dict:
    p = s.get(ProofRow, proof_id)
    if p is None:
        raise NotFound(f"Proof {proof_id} not found.")
    a = s.get(AttestationRow, p.attestation_id)
    return {"id": p.id, "borrower": p.borrower_id, "day": p.day, "date": clock.iso_date(s, p.day), "claim": CLAIM,
            "threshold": p.threshold, "commitment": p.commitment,
            "attestation": {"id": a.id, "source": a.source, "period_start": a.period_start,
                            "period_end": a.period_end, "account_hash": a.account_hash, "commitment": a.commitment,
                            "notary_pubkey": a.notary_pubkey, "signature": a.signature},
            "proof_b64": p.proof_b64, "public_inputs_b64": p.public_inputs_b64, "vk_b64": p.vk_b64}


def verify_proof(s: Session, proof_id: str, prover: Prover, keys: KeyStore) -> dict:
    """Independent re-verification against the circuit's canonical VK and Credent's published notary key."""
    pp = proof(s, proof_id)
    canonical_vk = prover.vk_b64()
    ledger_vk_hash = None
    for raw in s.exec(select(LedgerEvent.payload_json).where(LedgerEvent.type == "ProofVerified")):
        pl = json.loads(raw)
        if pl.get("proof_id") == proof_id:
            ledger_vk_hash = pl.get("vk_hash")
    sha = lambda v: hashlib.sha256(v.encode()).hexdigest()  # noqa: E731
    vk_ok = pp["vk_b64"] == canonical_vk and ledger_vk_hash == sha(canonical_vk)
    t0 = time.perf_counter()
    proof_ok = prover.verify(ProofArtifacts(pp["proof_b64"], pp["public_inputs_b64"], canonical_vk))
    ms = int((time.perf_counter() - t0) * 1000)
    trusted = pp["attestation"]["notary_pubkey"] == pubkey_b58(keys.get("notary"))
    att_ok = revenue.verify_attestation(revenue.to_attestation(s.get(AttestationRow, pp["attestation"]["id"])))
    th, cm = parse_public_inputs(base64.b64decode(pp["public_inputs_b64"]))
    t_ok, c_ok = th == pp["threshold"], cm == pp["attestation"]["commitment"]
    return {"proof_valid": proof_ok, "attestation_valid": att_ok, "notary_trusted": trusted, "vk_pinned": vk_ok,
            "threshold_bound": t_ok, "commitment_bound": c_ok,
            "valid": proof_ok and att_ok and trusted and vk_ok and t_ok and c_ok,
            "verifier": "UltraHonk (bb verify)", "ms": ms}


def lender_profile(s: Session, chain: ChainService, slug: str) -> dict:
    o = s.exec(select(Organization).where(Organization.slug == slug)).first()
    if o is None or o.kind != "LENDER":  # borrower identities are never public
        raise NotFound("Organisation not found.")
    return {"name": o.name, "slug": o.slug, "kind": o.kind, "website": o.website, "sector": o.sector,
            "country": o.country, "description": o.description,
            "logo_url": f"/api/uploads/{o.logo_path}" if o.logo_path else None, "pseudonym": o.pseudonym,
            "pools": [pool_view(s, chain, p) for p in s.exec(select(Pool).where(Pool.manager_org_id == o.id,
                                                                                Pool.status != "DRAFT"))]}


def reconcile(s: Session, chain: ChainService) -> None:
    """Proof of reserves: each vault's on-chain cUSD must equal the pool's book cash once transfers settle."""
    from credent.chain import spl

    pending = s.exec(select(ChainTransfer).where(col(ChainTransfer.status).in_(["PENDING", "SENT"]))).all()
    for p in s.exec(select(Pool).where(Pool.status != "DRAFT")):
        label = f"vault:{p.vault_index}"
        in_flight = any(label in t.legs_json for t in pending)
        onchain = spl.to_cents(chain.balance(label))
        book = pools.load(p).cash
        s.add(ReserveSnapshot(pool_id=p.id, onchain=onchain, book_cash=book, pending=int(in_flight),
                              ok=None if in_flight else onchain == book))
    s.commit()


def chain_info(chain: ChainService) -> dict:
    try:
        lamports = chain.client.sol_balance(chain.fee_payer.pubkey())
    except Exception:  # noqa: BLE001 - status endpoint must not fail on RPC trouble
        lamports = None
    return {"cluster": chain.cluster, "mint": str(chain.mint), "decimals": 6,
            "fee_payer": str(chain.fee_payer.pubkey()), "fee_payer_lamports": lamports,
            "mint_url": explorer_address(str(chain.mint), chain.cluster),
            "collections": str(chain.token_account("collections")),
            "treasury": str(chain.token_account("treasury"))}

