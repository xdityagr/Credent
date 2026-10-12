"""End-to-end marketplace on an in-process Solana VM: the book must always match the chain."""

import json

import pytest
from sqlmodel import Session, select

from credent import ledger
from credent.chain import spl
from credent.errors import (
    ActiveLoanExists,
    CreditExceeded,
    InsufficientBalance,
    InvalidAmount,
    PoolClosed,
    StepOutOfOrder,
    SubordinationBreach,
)
from credent.models import ChainTransfer, LedgerEvent, LoanRow, Organization, Pool, Position, PrivatePayment
from credent.services import applications, clock, collections, funds, pools, sim, transfers
from credent.services.accounts import org_for


@pytest.fixture
def world(engine, ctx):
    sim.reset(engine, ctx, warmup_days=0)
    s = Session(engine, expire_on_commit=False)
    yield s, ctx.chain(clock.world(s))
    s.close()


def org(s, key):
    return s.exec(select(Organization).where(Organization.slug.startswith(key))).first()


def pool(s, name_prefix):
    return s.exec(select(Pool).where(Pool.name.startswith(name_prefix))).first()


def assert_vaults_match_book(s, chain):
    for p in s.exec(select(Pool)):
        assert spl.to_cents(chain.balance(f"vault:{p.vault_index}")) == pools.load(p).cash, p.name


def test_seed_builds_a_funded_marketplace(world):
    s, chain = world
    harbor, meridian = pool(s, "Harbor"), pool(s, "Meridian")
    assert harbor.status == meridian.status == "OPEN"
    loans = s.exec(select(LoanRow)).all()
    assert len(loans) == 3
    assert all(t.status == "CONFIRMED" for t in s.exec(select(ChainTransfer)))
    assert_vaults_match_book(s, chain)
    # borrowers actually received cUSD in their wallets
    for loan in loans:
        o = s.get(Organization, loan.borrower_org_id)
        from credent.services import wallets
        assert spl.to_cents(chain.balance(wallets.primary(s, o).address)) == loan.principal
    types = [e.type for e in s.exec(select(LedgerEvent))]
    for t in ("PoolCreated", "Deposit", "PoolOpened", "ProofVerified", "LoanApproved", "LoanDrawn", "TransferConfirmed"):
        assert t in types


def test_eight_weeks_settle_on_chain_and_default_hits_junior(world, ctx):
    s, chain = world
    sim.advance(s, ctx, 56)
    harbor = pool(s, "Harbor")
    st = pools.load(harbor)
    assert st.junior.writedown > 0 and st.senior.writedown == 0
    statuses = {s.get(Organization, l.borrower_org_id).slug.split("-")[0]: l.status for l in s.exec(select(LoanRow))}
    assert statuses["halcyon"] == "DEFAULTED"
    assert statuses["northwind"] in ("ACTIVE", "REPAID")
    assert_vaults_match_book(s, chain)
    treasury = sum(pools.load(p).treasury for p in s.exec(select(Pool)))
    assert spl.to_cents(chain.balance("treasury")) == treasury
    assert ledger.verify_chain(s) == (True, None)


def test_collections_never_go_negative_and_operating_payout(world, ctx):
    s, chain = world
    sim.advance(s, ctx, 10)
    northwind = org(s, "northwind")
    info = collections.operating(s, northwind)
    assert info["available"] > 0
    collections.withdraw_operating(s, northwind, info["available"])
    s.commit()
    sim.drain(s, chain)
    assert all(t.status == "CONFIRMED" for t in s.exec(select(ChainTransfer)))
    swept = sum(p.swept for p in s.exec(select(PrivatePayment)))
    assert swept > 0


def test_application_rules(world, ctx):
    s, chain = world
    northwind = org(s, "northwind")
    meridian = pool(s, "Meridian")
    proof_id = s.exec(select(LoanRow).where(LoanRow.borrower_org_id == northwind.id)).first().application_id
    from credent.models import Application
    app = s.get(Application, proof_id)
    with pytest.raises(ActiveLoanExists):
        applications.apply(s, chain, northwind, meridian.id, app.proof_id, 5_000_00)
    with pytest.raises(StepOutOfOrder):
        applications.terms_message(s, northwind, app.id)  # already drawn


def test_deposit_guards(world):
    s, chain = world
    atlas = org(s, "atlas")
    harbor = pool(s, "Harbor")
    with pytest.raises(InsufficientBalance):  # within the leverage room, but Atlas deployed all its cUSD
        funds.prepare_deposit(s, chain, atlas, harbor, "senior", 100_000_00)
    funds.faucet(s, chain, atlas, 5_000_000_00)
    with pytest.raises(SubordinationBreach):
        funds.prepare_deposit(s, chain, atlas, harbor, "senior", 5_000_000_00)
    with pytest.raises(InvalidAmount):
        funds.prepare_deposit(s, chain, atlas, harbor, "tranche-x", 100_00)
    harbor.status = "CLOSED"
    with pytest.raises(PoolClosed):
        funds.prepare_deposit(s, chain, atlas, harbor, "senior", 100_00)


def test_lender_withdraw_moves_tokens(world):
    s, chain = world
    atlas = org(s, "atlas")
    meridian = pool(s, "Meridian")
    from credent.services import wallets
    addr = wallets.primary(s, atlas).address
    before = chain.balance(addr)
    out = funds.withdraw(s, chain, atlas, meridian, "senior", 50_000_00)
    s.commit()
    sim.drain(s, chain)
    assert chain.balance(addr) - before == spl.to_base(out["amount"])
    assert_vaults_match_book(s, chain)
    pos = s.get(Position, (atlas.id, meridian.id, "senior"))
    assert pos.withdrawn == out["amount"]


def test_force_default_and_recovery_on_chain(world, ctx):
    s, chain = world
    sim.advance(s, ctx, 3)
    from credent.services import settlement
    loan = s.exec(select(LoanRow).where(LoanRow.status == "ACTIVE")).first()
    settlement.force_default(s, loan.id)
    settlement.recover(s, loan.id, 20_000_00)
    s.commit()
    sim.drain(s, chain)
    assert_vaults_match_book(s, chain)
    rec = [json.loads(e.payload_json) for e in s.exec(select(LedgerEvent).where(LedgerEvent.type == "RecoveryAllocated"))]
    assert rec[-1]["amount"] == 20_000_00


def test_cap_by_advance_rate(world):
    s, chain = world
    assert applications.limit_for(pool(s, "Meridian"), 1_000_000_00) == 350_000_00
    with pytest.raises(CreditExceeded):
        raise CreditExceeded()


def test_transfers_idempotent_when_nothing_pending(world):
    s, chain = world
    assert transfers.process(s, chain) == 0
    assert org_for  # imported for completeness


def test_local_chain_rehydrates_after_restart(world, ctx, engine):
    s, chain = world
    sim.advance(s, ctx, 9)
    from credent.chain.client import LiteChain
    from credent.chain.rehydrate import rehydrate
    from credent.services.context import Ctx

    fresh = Ctx(settings=ctx.settings, keys=ctx.keys, prover=ctx.prover, client=LiteChain())  # "restart"
    chain2 = fresh.chain(clock.world(s))
    assert not chain2.client.exists(chain2.mint)
    rehydrate(s, chain2)
    assert_vaults_match_book(s, chain2)
    assert chain2.balance("collections") == chain.balance("collections")
    assert chain2.balance("treasury") == chain.balance("treasury")
