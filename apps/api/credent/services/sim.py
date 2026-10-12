"""Demo world: real organisations, pools, proofs, deposits and loans created through the
same services real users hit, plus a clock that generates customer payments for
demo businesses.

Demo logins (POST /auth/demo) land in these organisations. Nothing here is a
shortcut around the protocol: deposits are signed SPL transfers (by the server,
for custodial demo wallets), loans are drawn from vaults, payments are swept.
"""

import secrets
from datetime import datetime, timezone

from sqlmodel import Session, col, select

from credent.auth.security import hash_password
from credent.db import reset_db
from credent.errors import DomainError, InvalidAmount
from credent.models import Organization, RevenueSource, User
from credent.services import (
    applications,
    clock,
    collections,
    funds,
    orgs,
    pools,
    revenue,
    settlement,
    transfers,
    wallets,
)
from credent.services.context import Ctx
from credent.sources.profiles import PROFILES, payments_for_day

LENDERS = [
    {"key": "harbor", "name": "Harbor Credit Partners", "sector": "Private credit fund", "country": "United Kingdom",
     "website": "harborcredit.example",
     "description": "London-based private credit manager financing revenue-generating SMEs across Europe.",
     "pool": {"name": "Harbor Revenue Fund I", "target_size": 1_500_000_00, "senior_coupon_bps": 900,
              "borrower_apr_bps": 1800, "advance_bps": 4000, "term_epochs": 12, "min_threshold": 300_000_00,
              "min_first_loss": 250_000_00, "auto_approve": False,
              "description": "Diversified revenue-based credit for SaaS and e-commerce businesses with at least $300k of proven quarterly revenue."},
     "junior": 400_000_00},
    {"key": "meridian", "name": "Meridian Capital", "sector": "Venture debt", "country": "United States",
     "website": "meridian.example",
     "description": "Venture debt for recurring-revenue software companies.",
     "pool": {"name": "Meridian SaaS Credit", "target_size": 1_000_000_00, "senior_coupon_bps": 800,
              "borrower_apr_bps": 1500, "advance_bps": 3500, "term_epochs": 12, "min_threshold": 400_000_00,
              "min_first_loss": 200_000_00, "auto_approve": True, "auto_approve_max": 250_000_00,
              "description": "Lower-cost credit for subscription businesses. Applications under $250k with a valid proof are approved automatically."},
     "junior": 250_000_00},
]
CO_INVESTOR = {"key": "atlas", "name": "Atlas Family Office", "sector": "Family office", "country": "Singapore",
               "website": "atlas.example", "description": "Senior-only allocations to secured private credit.",
               "senior": {"harbor": 1_100_000_00, "meridian": 600_000_00}}
BORROWERS = [
    {"key": "northwind", "name": "Northwind Analytics", "profile": "saas", "sector": "B2B SaaS", "country": "India", "pool": "meridian",
     "website": "northwind.example", "description": "Analytics software for mid-market logistics teams."},
    {"key": "kestrel", "name": "Kestrel Outdoor Co.", "profile": "ecommerce", "sector": "D2C e-commerce", "country": "Canada", "pool": "harbor",
     "website": "kestrel.example", "description": "Outdoor gear sold direct to consumers."},
    {"key": "halcyon", "name": "Halcyon Logistics", "profile": "distressed", "sector": "Freight brokerage", "country": "Germany", "pool": "harbor",
     "website": "halcyon.example", "description": "Freight brokerage with one large anchor client."},
]
DEMO_DOMAIN = "demo.credent.dev"


def _demo_user(s: Session, key: str, name: str) -> User:
    u = User(email=f"{key}@{DEMO_DOMAIN}", password_hash=hash_password(secrets.token_urlsafe(24)), name=name,
             email_verified_at=datetime.now(timezone.utc))
    s.add(u)
    s.flush()
    return u


def _org(s: Session, ctx: Ctx, world: str, key: str, kind: str, spec: dict) -> tuple[User, Organization]:
    user = _demo_user(s, key, f"{spec['name']} (demo)")
    org = orgs.create(s, user, kind, {k: spec[k] for k in ("name", "website", "sector", "country", "description")},
                      is_demo=True)
    wallets.create_custodial(s, ctx, world, user, org)
    return user, org


def _deposit(s: Session, chain, org: Organization, p, tranche: str, cents: int) -> None:
    prep = funds.prepare_deposit(s, chain, org, p, tranche, cents)
    funds.submit_deposit(s, chain, org, prep["intent_id"], None)  # custodial: already signed by the server


def reset(engine, ctx: Ctx, warmup_days: int = 28) -> None:
    ctx.prover.ensure_available()  # fail before wiping anything
    with ctx.write_lock:
        reset_db(engine)
        with Session(engine, expire_on_commit=False) as s:
            st = clock.state(s)
            world = st.world
            s.commit()
            chain = ctx.chain(world)
            chain.bootstrap()
            seed(s, ctx, chain, world)
            if warmup_days:
                advance(s, ctx, warmup_days)


def seed(s: Session, ctx: Ctx, chain, world: str) -> None:
    managers, pool_by_key = {}, {}
    for spec in LENDERS:
        user, org = _org(s, ctx, world, spec["key"], "LENDER", spec)
        funds.faucet(s, chain, org, spec["junior"] + 50_000_00)
        p = pools.create(s, chain, user, org, spec["pool"])
        pools.start_funding(s, chain, user, org, p)
        s.commit()
        _deposit(s, chain, org, p, "junior", spec["junior"])
        pools.open_for_loans(s, user, org, p)
        s.commit()
        managers[spec["key"]], pool_by_key[spec["key"]] = (user, org), p
    _, atlas = _org(s, ctx, world, CO_INVESTOR["key"], "LENDER", CO_INVESTOR)
    funds.faucet(s, chain, atlas, sum(CO_INVESTOR["senior"].values()))
    s.commit()
    for key, amount in CO_INVESTOR["senior"].items():
        _deposit(s, chain, atlas, pool_by_key[key], "senior", amount)
    for spec in BORROWERS:
        user, org = _org(s, ctx, world, spec["key"], "BORROWER", spec)
        src = revenue.connect_demo(s, org, spec["profile"])
        series = revenue.series(s, src)
        proof = revenue.prove(s, ctx, org, src, revenue.suggest(series.total))
        s.commit()
        p = pool_by_key[spec["pool"]]
        amount = applications.limit_for(p, proof.threshold) // 1_000_00 * 1_000_00
        app = applications.apply(s, chain, org, p.id, proof.id, amount)
        if app.status == "SUBMITTED":
            muser, morg = managers[spec["pool"]]
            applications.decide(s, muser, morg, app.id, True, "Strong proven revenue relative to request.")
        applications.terms_message(s, org, app.id)
        applications.accept(s, chain, org, app.id, None)
        s.commit()
    drain(s, chain)


def drain(s: Session, chain, rounds: int = 20) -> None:
    for _ in range(rounds):
        if not transfers.process(s, chain):
            return


def advance(s: Session, ctx: Ctx, days: int) -> int:
    if not 1 <= days <= 365:
        raise InvalidAmount("Advance between 1 and 365 days.")
    chain = ctx.chain(clock.world(s))
    with ctx.write_lock:
        for _ in range(days):
            s.expire_all()  # another thread (the clock job) may have advanced the day
            st = clock.state(s)
            day = st.day
            demo_sources = s.exec(select(RevenueSource).where(RevenueSource.kind == "DEMO",
                                                              RevenueSource.status == "ACTIVE")
                                  .order_by(col(RevenueSource.created))).all()
            for src in demo_sources:
                for i, amount in enumerate(payments_for_day(PROFILES[src.profile], src.seed, day, src.collapse_day)):
                    collections.ingest(s, src.org_id, amount, f"demo:{src.id}:{day}:{i}", src.id, day)
            st.day = day + 1
            s.add(st)
            collections.mint_inflows(s, day)
            if st.day % settlement.EPOCH_DAYS == 0:
                settlement.settle_week(s, st.day)
            s.info.setdefault("published", []).append({"type": "SimTick", "day": st.day})
            s.commit()
        if chain.cluster == "local":
            drain(s, chain)
    return clock.today(s)


def sandbox(s: Session) -> bool:
    """True while every organisation is a demo one; global time controls are only safe then."""
    return s.exec(select(Organization).where(Organization.is_demo == False)).first() is None  # noqa: E712


def demo_user(s: Session, role: str) -> User:
    key = {"borrower": "northwind", "lender": "harbor", "investor": "atlas"}.get(role)
    if key is None:
        raise InvalidAmount("Choose borrower or lender.")
    u = s.exec(select(User).where(User.email == f"{key}@{DEMO_DOMAIN}")).first()
    if u is None:
        raise DomainError("The demo world isn't seeded yet. Try again in a moment.")
    return u
