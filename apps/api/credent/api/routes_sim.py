from fastapi import APIRouter, Depends, Request

from credent.api import schemas as S
from credent.api.deps import CtxDep, SessionDep, require_sim
from credent.services import clock, sim

router = APIRouter(prefix="/sim", tags=["sim"], dependencies=[Depends(require_sim)])


@router.post("/reset")
def reset(ctx: CtxDep, request: Request, s: SessionDep) -> dict:
    s.close()
    with request.app.state.lock:
        sim.reset(request.app.state.engine, ctx)
    return {"ok": True}


@router.post("/advance")
def advance(body: S.AdvanceIn, s: SessionDep, request: Request) -> dict:
    with request.app.state.lock:
        return {"day": sim.advance(s, body.days)}


@router.post("/payment")
def payment(body: S.PaymentIn, s: SessionDep, request: Request) -> dict:
    with request.app.state.lock:
        p = sim.payment(s, body.borrower, body.amount)
    return {"day": clock.today(s), "swept": p.swept, "released": p.released}


@router.post("/default")
def default(body: S.LoanIn, s: SessionDep, request: Request) -> dict:
    with request.app.state.lock:
        sim.force_default(s, body.loan_id)
    return {"ok": True}


@router.post("/recover")
def recover(body: S.RecoverIn, s: SessionDep, request: Request) -> dict:
    with request.app.state.lock:
        sim.recover(s, body.loan_id, body.amount)
    return {"ok": True}
