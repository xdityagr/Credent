"""Public, unauthenticated routes: the open loan book."""

import json

from fastapi import APIRouter, Request
from solders.keypair import Keypair
from sqlmodel import select
from sse_starlette.sse import EventSourceResponse

from credent.api.deps import ChainDep, CtxDep, SessionDep, client_ip, limiter
from credent.crypto.keys import pubkey_b58
from credent.errors import DomainError
from credent.events import broadcaster
from credent.models import Pool
from credent.services import clock, public
from credent.sources.profiles import PROFILES

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/status")
def status(s: SessionDep, ctx: CtxDep, chain: ChainDep, request: Request) -> dict:
    try:
        ctx.prover.ensure_available()
        prover = {"ok": True, "message": None}
    except DomainError as e:
        prover = {"ok": False, "message": e.message}
    st = request.app.state
    return {"day": clock.today(s), "date": clock.iso_date(s, clock.today(s)),
            "seeded": s.exec(select(Pool)).first() is not None, "seeding": st.seeding, "seed_error": st.seed_error,
            "clock_mode": ctx.settings.clock_mode, "seconds_per_day": ctx.settings.seconds_per_day,
            "sim_enabled": ctx.settings.sim_enabled, "prover": prover, "chain": public.chain_info(chain),
            # the ledger-anchoring wallet pays for its own memo transactions on devnet
            "anchor": {"enabled": ctx.settings.anchor_enabled,
                       "address": str(Keypair.from_seed(bytes(ctx.keys.get("anchor"))).pubkey())},
            "notary_pubkey": pubkey_b58(ctx.keys.get("notary")),
            "processor_pubkey": pubkey_b58(ctx.keys.get("processor"))}


@router.get("/stats")
def stats(s: SessionDep) -> dict:
    return public.stats(s)


@router.get("/profiles")
def profiles() -> list[dict]:
    return [{"key": p.key, "label": p.label, "description": p.description} for p in PROFILES.values()]


@router.get("/pools")
def pools_list(s: SessionDep, chain: ChainDep) -> list[dict]:
    return public.pools_list(s, chain)


@router.get("/pools/{slug}")
def pool(slug: str, s: SessionDep, chain: ChainDep) -> dict:
    return public.pool_detail(s, chain, slug)


@router.get("/loans")
def loans(s: SessionDep, chain: ChainDep, pool: str | None = None) -> list[dict]:
    return public.loans_list(s, chain, pool)


@router.get("/loans/{loan_id}")
def loan(loan_id: str, s: SessionDep, chain: ChainDep) -> dict:
    return public.loan_detail(s, chain, loan_id)


@router.get("/ledger")
def ledger_events(s: SessionDep, chain: ChainDep, after: int | None = None, before: int | None = None,
                  limit: int = 100, type: str | None = None, pool: str | None = None) -> list[dict]:
    return public.events(s, chain, after, before, limit, type, pool)


@router.get("/ledger/verify")
def verify_chain(s: SessionDep) -> dict:
    return public.verify_chain(s)


@router.get("/blocks")
def blocks(s: SessionDep, chain: ChainDep) -> list[dict]:
    return public.blocks(s, chain)


@router.get("/proofs/{proof_id}")
def proof(proof_id: str, s: SessionDep) -> dict:
    return public.proof(s, proof_id)


@router.post("/proofs/{proof_id}/verify")
def verify_proof(proof_id: str, s: SessionDep, ctx: CtxDep, request: Request) -> dict:
    limiter.check(f"verify:{client_ip(request)}", 20, 60)
    return public.verify_proof(s, proof_id, ctx.prover, ctx.keys)


@router.get("/stream")
async def stream(request: Request):
    async def gen():
        yield {"event": "hello", "data": json.dumps({"ok": True})}
        async for item in broadcaster.subscribe():
            if await request.is_disconnected():
                break
            if item.get("type") == "Notification":
                continue  # org-scoped; never on the public stream
            yield {"event": "ledger", "data": json.dumps(item)}

    return EventSourceResponse(gen(), ping=15)


