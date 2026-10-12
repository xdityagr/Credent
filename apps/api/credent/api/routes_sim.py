"""Demo controls, available to members of demo organisations only."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from credent.api.deps import CtxDep, SessionDep, require_demo
from credent.errors import Forbidden
from credent.models import LoanRow, Organization, Pool
from credent.services import clock, loans, settlement, sim


def _sandbox_only(s) -> None:
    if not sim.sandbox(s):
        raise Forbidden("Demo time controls are off once real organisations use this deployment. "
                        "The clock keeps running on its own.")


def _demo_loan(s, loan_id: str) -> LoanRow:
    loan = loans.get(s, loan_id)
    pool = s.get(Pool, loan.pool_id)
    borrower, manager = s.get(Organization, loan.borrower_org_id), s.get(Organization, pool.manager_org_id)
    if not (borrower.is_demo and manager.is_demo):
        raise Forbidden("Demo controls only apply to demo loans.")
    return loan

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
    _sandbox_only(s)
    return {"day": sim.advance(s, ctx, body.days), "date": clock.iso_date(s, clock.today(s))}


@router.post("/default")
def default(body: LoanIn, _: DemoOrg, s: SessionDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        settlement.force_default(s, _demo_loan(s, body.loan_id).id)
        s.commit()
    return {"ok": True}


@router.post("/recover")
def recover(body: RecoverIn, _: DemoOrg, s: SessionDep, ctx: CtxDep) -> dict:
    if body.amount > 10_000_000_00:
        raise Forbidden("Recoveries above $10M aren't allowed in the demo.")
    with ctx.write_lock:
        settlement.recover(s, _demo_loan(s, body.loan_id).id, body.amount)
        s.commit()
    return {"ok": True}


@router.post("/clock")
def set_clock(body: ClockIn, _: DemoOrg, s: SessionDep) -> dict:
    _sandbox_only(s)
    st = clock.state(s)
    st.mode = "manual" if body.mode == "manual" else "accelerated"
    s.add(st)
    s.commit()
    return {"mode": st.mode}


@router.post("/reset")
def reset(_: DemoOrg, request: Request, s: SessionDep, ctx: CtxDep) -> dict:
    _sandbox_only(s)
    s.close()
    sim.reset(request.app.state.engine, ctx)
    return {"ok": True}
