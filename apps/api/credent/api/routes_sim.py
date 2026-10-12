"""Demo controls, available to members of demo organisations only."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from credent.api.deps import CtxDep, SessionDep, require_demo
from credent.models import Organization
from credent.services import clock, settlement, sim

router = APIRouter(prefix="/sim", tags=["sim"])
DemoOrg = Annotated[Organization, Depends(require_demo)]


class AdvanceIn(BaseModel):
    days: int = Field(ge=1, le=120)


class LoanIn(BaseModel):
    loan_id: str


class RecoverIn(BaseModel):
    loan_id: str
    amount: int = Field(gt=0)


class ClockIn(BaseModel):
    mode: str


@router.post("/advance")
def advance(body: AdvanceIn, _: DemoOrg, s: SessionDep, ctx: CtxDep) -> dict:
    return {"day": sim.advance(s, ctx, body.days), "date": clock.iso_date(s, clock.today(s))}


@router.post("/default")
def default(body: LoanIn, _: DemoOrg, s: SessionDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        settlement.force_default(s, body.loan_id)
        s.commit()
    return {"ok": True}


@router.post("/recover")
def recover(body: RecoverIn, _: DemoOrg, s: SessionDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        settlement.recover(s, body.loan_id, body.amount)
        s.commit()
    return {"ok": True}


@router.post("/clock")
def set_clock(body: ClockIn, _: DemoOrg, s: SessionDep) -> dict:
    st = clock.state(s)
    st.mode = "manual" if body.mode == "manual" else "accelerated"
    s.add(st)
    s.commit()
    return {"mode": st.mode}


@router.post("/reset")
def reset(_: DemoOrg, request: Request, s: SessionDep, ctx: CtxDep) -> dict:
    s.close()
    sim.reset(request.app.state.engine, ctx)
    return {"ok": True}
