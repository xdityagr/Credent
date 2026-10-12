"""Lender-run pools: lifecycle, terms, and the persisted tranche state.

Lifecycle: DRAFT (editable) → FUNDING (accepts deposits) → OPEN (also accepts
applications; requires the first-loss junior capital) → CLOSED (no new loans or
deposits; withdrawals still allowed).
"""

import json
import re

from sqlmodel import Session, col, func, select

from credent import ledger
from credent.core import pool as poolcore
from credent.errors import Forbidden, InvalidAmount, NotFound, PoolClosed
from credent.models import Organization, Pool, User
from credent.services import audit, clock

EDITABLE = ("name", "description", "target_size", "senior_coupon_bps", "max_leverage_x100", "borrower_apr_bps",
            "advance_bps", "term_epochs", "min_threshold", "max_loan", "min_first_loss", "auto_approve",
            "auto_approve_max")
LIMITS = {
    "senior_coupon_bps": (0, 3000), "max_leverage_x100": (0, 1000), "borrower_apr_bps": (100, 6000),
    "advance_bps": (500, 8000), "term_epochs": (4, 52), "target_size": (100_000_00, 1_000_000_000_00),
}


def terms(p: Pool) -> poolcore.PoolTerms:
    return poolcore.PoolTerms(senior_coupon_bps=p.senior_coupon_bps, max_leverage_x100=p.max_leverage_x100,
                              fee_bps=p.fee_bps)


def load(p: Pool) -> poolcore.Pool:
    d = json.loads(p.state_json or "{}")
    return poolcore.Pool.from_dict(d) if d else poolcore.Pool()


def save(s: Session, p: Pool, state: poolcore.Pool) -> None:
    state.check()
    p.state_json = json.dumps(state.to_dict())
    s.add(p)


def _validate(fields: dict) -> dict:
    out = {}
    for k in EDITABLE:
        if k not in fields or fields[k] is None:
            continue
        v = fields[k]
        if k in ("name", "description"):
            v = str(v).strip()[: 80 if k == "name" else 2000]
            if k == "name" and not v:
                raise InvalidAmount("Pool name is required.")
        elif k == "auto_approve":
            v = bool(v)
        else:
            if not isinstance(v, int) or v < 0:
                raise InvalidAmount(f"{k.replace('_', ' ')} must be a non-negative whole number.")
            lo, hi = LIMITS.get(k, (0, 10**15))
            if not lo <= v <= hi:
                raise InvalidAmount(f"{k.replace('_', ' ')} must be between {lo} and {hi}.")
        out[k] = v
    if out.get("max_leverage_x100") == 0:
        raise InvalidAmount("Max leverage of 0 means no senior capital; use at least 1x.")
    return out


def _slug(s: Session, name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "pool"
    slug, n = base, 2
    while s.exec(select(Pool).where(Pool.slug == slug)).first():
        slug, n = f"{base}-{n}", n + 1
    return slug


def create(s: Session, chain, user: User, org: Organization, fields: dict) -> Pool:
    data = _validate(fields)
    if "name" not in data or "target_size" not in data:
        raise InvalidAmount("Name and target size are required.")
    idx = (s.exec(select(func.max(Pool.vault_index))).one() or 0) + 1
    p = Pool(slug=_slug(s, data["name"]), manager_org_id=org.id, vault_index=idx, **data)
    p.vault_address = str(chain.token_account(f"vault:{idx}"))
    s.add(p)
    s.flush()
    audit.log(s, user.id, org.id, "pool.create", p.slug)
    return p


def manage(s: Session, org: Organization, pool_id: str) -> Pool:
    p = get(s, pool_id)
    if p.manager_org_id != org.id:
        raise Forbidden("Only the pool's manager can do that.")
    return p


def get(s: Session, pool_id: str) -> Pool:
    p = s.get(Pool, pool_id) or s.exec(select(Pool).where(Pool.slug == pool_id)).first()
    if p is None:
        raise NotFound("Pool not found.")
    return p


def update(s: Session, user: User, org: Organization, p: Pool, fields: dict) -> Pool:
    data = _validate(fields)
    economic = set(data) - {"name", "description", "auto_approve", "auto_approve_max"}
    if economic and p.status != "DRAFT":
        raise PoolClosed("Economic terms are locked once a pool starts funding.")
    for k, v in data.items():
        setattr(p, k, v)
    s.add(p)
    audit.log(s, user.id, org.id, "pool.update", p.slug, **data)
    return p


def _event_terms(p: Pool) -> dict:
    return {"pool_id": p.id, "slug": p.slug, "name": p.name, "senior_coupon_bps": p.senior_coupon_bps,
            "max_leverage_x100": p.max_leverage_x100, "fee_bps": p.fee_bps, "borrower_apr_bps": p.borrower_apr_bps,
            "advance_bps": p.advance_bps, "term_epochs": p.term_epochs, "min_threshold": p.min_threshold,
            "target_size": p.target_size, "vault": p.vault_address}


def start_funding(s: Session, chain, user: User, org: Organization, p: Pool) -> Pool:
    if p.status != "DRAFT":
        raise PoolClosed("Pool is already live.")
    chain.ensure_account(f"vault:{p.vault_index}")
    p.status = "FUNDING"
    s.add(p)
    ledger.append(s, clock.today(s), "PoolCreated", {**_event_terms(p), "manager": org.pseudonym,
                                                     "manager_name": org.name})
    audit.log(s, user.id, org.id, "pool.fund", p.slug)
    return p


def open_for_loans(s: Session, user: User, org: Organization, p: Pool) -> Pool:
    if p.status != "FUNDING":
        raise PoolClosed("Only a funding pool can be opened for applications.")
    junior = load(p).junior.nav
    floor = max(p.min_first_loss, 1)
    if junior < floor:
        raise PoolClosed(f"Deposit at least {floor} cents of first-loss (junior) capital before opening.")
    p.status = "OPEN"
    s.add(p)
    ledger.append(s, clock.today(s), "PoolOpened", {"pool_id": p.id, "junior": junior})
    audit.log(s, user.id, org.id, "pool.open", p.slug)
    return p


def close(s: Session, user: User, org: Organization, p: Pool) -> Pool:
    if p.status == "CLOSED":
        return p
    p.status = "CLOSED"
    s.add(p)
    ledger.append(s, clock.today(s), "PoolClosed", {"pool_id": p.id})
    audit.log(s, user.id, org.id, "pool.close", p.slug)
    return p


def for_manager(s: Session, org: Organization) -> list[Pool]:
    return list(s.exec(select(Pool).where(Pool.manager_org_id == org.id).order_by(col(Pool.created).desc())))
