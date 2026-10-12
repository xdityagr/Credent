import json

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from credent.api import schemas as S
from credent.api.deps import CtxDep, SessionDep
from credent.crypto.keys import pubkey_b58
from credent.errors import DomainError
from credent.events import broadcaster
from credent.models import PoolRow
from credent.services import clock, public
from credent.sources.profiles import PROFILES

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/status")
def status(s: SessionDep, ctx: CtxDep, request: Request) -> S.PublicStatus:
    try:
        ctx.prover.ensure_available()
        prover = S.ProverStatus(ok=True, message=None)
    except DomainError as e:
        prover = S.ProverStatus(ok=False, message=e.message)
    st = request.app.state
    return S.PublicStatus(
        day=clock.today(s), seeded=s.get(PoolRow, 1) is not None, seeding=st.seeding,
        seed_error=st.seed_error, sim_enabled=ctx.settings.sim_enabled, prover=prover,
        anchor=S.AnchorStatus(**st.anchor.status()),
        notary_pubkey=pubkey_b58(ctx.keys.get("notary")),
        processor_pubkey=pubkey_b58(ctx.keys.get("processor")),
    )


@router.get("/profiles")
def profiles() -> list[S.PublicProfile]:
    return [S.PublicProfile(key=p.key, label=p.label, description=p.description) for p in PROFILES.values()]


@router.get("/pool")
def pool(s: SessionDep) -> S.PublicPool:
    return public.pool(s)


@router.get("/tranches/history")
def nav_history(s: SessionDep) -> list[S.PublicNavPoint]:
    return public.nav_history(s)


@router.get("/loans")
def loans(s: SessionDep) -> list[S.PublicLoan]:
    return public.loans(s)


@router.get("/loans/{loan_id}")
def loan(loan_id: str, s: SessionDep) -> S.PublicLoanDetail:
    return public.loan_detail(s, loan_id)


@router.get("/ledger")
def ledger_events(s: SessionDep, after: int | None = None, before: int | None = None,
                  limit: int = 100, type: str | None = None) -> list[S.PublicEvent]:
    return public.events(s, after, before, limit, type)


@router.get("/ledger/verify")
def verify_chain(s: SessionDep) -> S.ChainVerifyOut:
    return public.verify_chain(s)


@router.get("/blocks")
def blocks(s: SessionDep, request: Request) -> list[S.PublicBlock]:
    return public.blocks(s, request.app.state.anchor)


@router.get("/proofs/{proof_id}")
def proof(proof_id: str, s: SessionDep) -> S.PublicProof:
    return public.proof(s, proof_id)


@router.post("/proofs/{proof_id}/verify")
def verify_proof(proof_id: str, s: SessionDep, ctx: CtxDep) -> S.ProofVerifyOut:
    return public.verify_proof(s, proof_id, ctx.prover)


@router.get("/stream")
async def stream(request: Request):
    async def gen():
        yield {"event": "hello", "data": json.dumps({"ok": True})}
        async for item in broadcaster.subscribe():
            if await request.is_disconnected():
                break
            yield {"event": "ledger", "data": json.dumps(item)}

    return EventSourceResponse(gen(), ping=15)
