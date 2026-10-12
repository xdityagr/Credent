"""Authenticated portal routes: chain, borrower, lender, notifications."""

import csv
import io
import json
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import col, select

from credent.api.deps import BorrowerDep, ChainDep, CtxDep, LenderDep, OrgDep, SessionDep, UserDep, limiter
from credent.chain.client import explorer_tx
from credent.errors import Forbidden, NotFound, ReceiptInvalid
from credent.models import Application, ChainTransfer, LoanRow, Notification, Organization, Pool, Position
from credent.services import (
    applications,
    clock,
    collections,
    funds,
    loans,
    pools,
    public,
    revenue,
    transfers,
)

router = APIRouter()


# ---------------------------------------------------------------- chain

@router.get("/chain/config", tags=["chain"])
def chain_config(chain: ChainDep) -> dict:
    return {**public.chain_info(chain), "enabled": True}


@router.get("/chain/balance", tags=["chain"])
def chain_balance(org: OrgDep, s: SessionDep, chain: ChainDep) -> dict:
    return funds.balance(s, chain, org)


@router.post("/chain/faucet", tags=["chain"])
def chain_faucet(org: OrgDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        out = funds.faucet(s, chain, org, ctx.settings.faucet_amount)
        s.commit()
    return out


@router.get("/chain/transfers", tags=["chain"])
def my_transfers(org: OrgDep, s: SessionDep, chain: ChainDep) -> list[dict]:
    rows = s.exec(select(ChainTransfer).where(ChainTransfer.org_id == org.id)
                  .order_by(col(ChainTransfer.id).desc()).limit(100)).all()
    out = [{"id": t.id, "kind": t.kind, "status": t.status, "signature": t.signature,
            "amount": sum(l["amount"] for l in json.loads(t.legs_json)) // 10_000,
            "explorer_url": explorer_tx(t.signature, chain.cluster) if t.signature else None,
            "created_at": t.created_at.isoformat(), "error": t.last_error if t.status == "FAILED" else None}
           for t in rows]
    for d in funds.deposits(s, org):
        p = s.get(Pool, d.pool_id)
        out.append({"id": d.id, "kind": "DEPOSIT", "status": d.status, "signature": d.signature, "amount": d.amount,
                    "explorer_url": explorer_tx(d.signature, chain.cluster) if d.signature else None,
                    "created_at": d.created_at.isoformat(), "error": d.error, "pool": p.name, "tranche": d.tranche})
    return sorted(out, key=lambda r: r["created_at"], reverse=True)


# ---------------------------------------------------------------- borrower: revenue & proofs

class DemoSourceIn(BaseModel):
    profile: str


class StripeIn(BaseModel):
    key: str


class ProveIn(BaseModel):
    source_id: str
    threshold: int


@router.get("/borrower/sources", tags=["borrower"])
def list_sources(org: BorrowerDep, s: SessionDep) -> list[dict]:
    return [revenue.source_view(s, src) for src in revenue.sources(s, org)]


@router.post("/borrower/sources/demo", tags=["borrower"])
def connect_demo(body: DemoSourceIn, org: BorrowerDep, s: SessionDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        src = revenue.connect_demo(s, org, body.profile)
        s.commit()
    return revenue.source_view(s, src)


@router.post("/borrower/sources/stripe", tags=["borrower"])
def connect_stripe(body: StripeIn, org: BorrowerDep, s: SessionDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        src = revenue.connect_stripe(s, ctx, org, body.key)
        s.commit()
    return revenue.source_view(s, src)


@router.get("/borrower/sample-receipts", tags=["borrower"])
def sample_receipts(org: BorrowerDep, s: SessionDep, ctx: CtxDep, profile: str = "saas", tampered: bool = False):
    rows = revenue.sample_receipts(s, ctx, profile, tampered)
    name = f"receipts-{profile}{'-tampered' if tampered else ''}.json"
    return JSONResponse(rows, headers={"Content-Disposition": f'attachment; filename="{name}"'})


def _parse_upload(raw: bytes) -> list[dict]:
    text = raw.decode("utf-8-sig").strip()
    if text.startswith("["):
        try:
            rows = json.loads(text)
        except json.JSONDecodeError as e:
            raise ReceiptInvalid(f"Invalid JSON: {e.msg}.") from e
        if not isinstance(rows, list):
            raise ReceiptInvalid("Expected a JSON array of receipts.")
        return rows
    return list(csv.DictReader(io.StringIO(text)))


@router.post("/borrower/sources/receipts", tags=["borrower"])
async def connect_receipts(org: BorrowerDep, s: SessionDep, ctx: CtxDep, file: Annotated[UploadFile, File()],
                           label: Annotated[str, Form()] = "Signed receipts") -> dict:
    rows = _parse_upload(await file.read(5_000_000))
    with ctx.write_lock:
        src = revenue.connect_receipts(s, ctx, org, rows, label)
        s.commit()
    return revenue.source_view(s, src)


@router.delete("/borrower/sources/{source_id}", tags=["borrower"])
def disconnect(source_id: str, org: BorrowerDep, s: SessionDep) -> dict:
    revenue.disconnect(s, org, source_id)
    s.commit()
    return {"ok": True}


@router.post("/borrower/sources/{source_id}/attest", tags=["borrower"])
def attest(source_id: str, org: BorrowerDep, s: SessionDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        att = revenue.attest(s, ctx, org, revenue.get_source(s, org, source_id))
        s.commit()
    return {"id": att.id, "commitment": att.commitment, "source": att.source, "signature": att.signature,
            "notary_pubkey": att.notary_pubkey}


@router.post("/borrower/proofs", tags=["borrower"])
def create_proof(body: ProveIn, org: BorrowerDep, s: SessionDep, ctx: CtxDep) -> dict:
    limiter.check(f"prove:{org.id}", 10, 600)
    src = revenue.get_source(s, org, body.source_id)
    commitment, art = revenue.compute(ctx, s, src, body.threshold)  # proving runs outside the write lock
    with ctx.write_lock:
        proof = revenue.prove(s, ctx, org, src, body.threshold, art=art, commitment=commitment)
        s.commit()
    return revenue.proof_view(s, proof)


@router.get("/borrower/proofs", tags=["borrower"])
def list_proofs(org: BorrowerDep, s: SessionDep) -> list[dict]:
    return [revenue.proof_view(s, p) for p in revenue.proofs(s, org)]


# ---------------------------------------------------------------- borrower: applications & loans

class ApplyIn(BaseModel):
    pool_id: str
    proof_id: str
    amount: int


class AcceptIn(BaseModel):
    signature: str | None = None


class AmountIn(BaseModel):
    amount: int | None = None


@router.post("/borrower/applications", status_code=201, tags=["borrower"])
def apply(body: ApplyIn, org: BorrowerDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        app = applications.apply(s, chain, org, body.pool_id, body.proof_id, body.amount, ctx.settings)
        s.commit()
    return applications.view(s, app)


@router.get("/borrower/applications", tags=["borrower"])
def my_applications(org: BorrowerDep, s: SessionDep) -> list[dict]:
    return [applications.view(s, a) for a in applications.for_borrower(s, org)]


@router.get("/borrower/applications/{app_id}", tags=["borrower"])
def my_application(app_id: str, org: BorrowerDep, s: SessionDep) -> dict:
    app = applications.get(s, app_id)
    if app.borrower_org_id != org.id:
        raise NotFound("Application not found.")
    return applications.view(s, app)


@router.post("/borrower/applications/{app_id}/withdraw", tags=["borrower"])
def withdraw_application(app_id: str, org: BorrowerDep, s: SessionDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        app = applications.withdraw(s, org, app_id)
        s.commit()
    return applications.view(s, app)


@router.post("/borrower/applications/{app_id}/terms", tags=["borrower"])
def terms(app_id: str, org: BorrowerDep, s: SessionDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        msg = applications.terms_message(s, org, app_id)
        s.commit()
    return {"message": msg}


@router.post("/borrower/applications/{app_id}/accept", tags=["borrower"])
def accept(app_id: str, body: AcceptIn, org: BorrowerDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        loan = applications.accept(s, chain, org, app_id, body.signature, ctx.settings)
        s.commit()
        transfers.process(s, chain)
    return loans.private_view(s, chain, s.get(LoanRow, loan.id))


@router.get("/borrower/loans", tags=["borrower"])
def my_loans(org: BorrowerDep, s: SessionDep, chain: ChainDep) -> list[dict]:
    rows = s.exec(select(LoanRow).where(LoanRow.borrower_org_id == org.id).order_by(col(LoanRow.created).desc()))
    return [loans.private_view(s, chain, l) for l in rows]


@router.get("/borrower/loans/{loan_id}", tags=["borrower"])
def my_loan(loan_id: str, org: BorrowerDep, s: SessionDep, chain: ChainDep) -> dict:
    loan = loans.get(s, loan_id)
    if loan.borrower_org_id != org.id:
        raise NotFound(f"Loan {loan_id} not found.")
    return loans.private_view(s, chain, loan)


@router.get("/borrower/payments", tags=["borrower"])
def my_payments(org: BorrowerDep, s: SessionDep) -> list[dict]:
    return [{"id": p.id, "day": p.day, "date": clock.iso_date(s, p.day), "amount": p.amount, "swept": p.swept,
             "released": p.released, "loan_id": p.loan_id} for p in collections.payments(s, org)]


@router.get("/borrower/operating", tags=["borrower"])
def operating(org: BorrowerDep, s: SessionDep) -> dict:
    return collections.operating(s, org)


@router.post("/borrower/operating/withdraw", tags=["borrower"])
def withdraw_operating(body: AmountIn, org: BorrowerDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        out = collections.withdraw_operating(s, org, body.amount)
        s.commit()
        transfers.process(s, chain)
    return out


@router.get("/borrower/overview", tags=["borrower"])
def borrower_overview(org: BorrowerDep, s: SessionDep, chain: ChainDep) -> dict:
    loan = loans.active_for(s, org.id)
    apps = applications.for_borrower(s, org)
    srcs = revenue.sources(s, org)
    prfs = revenue.proofs(s, org)
    return {"wallet": funds.balance(s, chain, org), "operating": collections.operating(s, org),
            "active_loan": loans.private_view(s, chain, loan) if loan else None,
            "open_application": next((applications.view(s, a) for a in apps if a.status in ("SUBMITTED", "APPROVED")), None),
            "checklist": {"source": bool(srcs), "proof": bool(prfs), "applied": bool(apps), "loan": loan is not None},
            "best_proof": revenue.proof_view(s, prfs[0]) if prfs else None, "date": clock.iso_date(s, clock.today(s))}


# ---------------------------------------------------------------- lender: pools

class PoolIn(BaseModel):
    name: str
    description: str = ""
    target_size: int
    senior_coupon_bps: int = 900
    max_leverage_x100: int = 400
    borrower_apr_bps: int = 1800
    advance_bps: int = 4000
    term_epochs: int = 12
    min_threshold: int = 0
    max_loan: int = 0
    min_first_loss: int = 0
    auto_approve: bool = False
    auto_approve_max: int = 0


class PoolPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    target_size: int | None = None
    senior_coupon_bps: int | None = None
    max_leverage_x100: int | None = None
    borrower_apr_bps: int | None = None
    advance_bps: int | None = None
    term_epochs: int | None = None
    min_threshold: int | None = None
    max_loan: int | None = None
    min_first_loss: int | None = None
    auto_approve: bool | None = None
    auto_approve_max: int | None = None


def _manager_view(s, chain, p: Pool) -> dict:
    base = public.pool_view(s, chain, p)
    investors = []
    for pos in s.exec(select(Position).where(Position.pool_id == p.id)):
        o = s.get(Organization, pos.org_id)
        investors.append({"org": o.name, "pseudonym": o.pseudonym, "tranche": pos.tranche, "deposited": pos.deposited,
                          "withdrawn": pos.withdrawn, "shares": pos.shares})
    return {**base, "investors": investors,
            "applications": [applications.view(s, a, for_manager=True)
                             for a in s.exec(select(Application).where(Application.pool_id == p.id)
                                             .order_by(col(Application.created).desc()))],
            "loans": [public.loan_view(s, chain, l) for l in s.exec(select(LoanRow).where(LoanRow.pool_id == p.id))],
            "nav_history": public.pool_detail(s, chain, p.slug)["nav_history"] if p.status != "DRAFT" else []}


@router.post("/lender/pools", status_code=201, tags=["lender"])
def create_pool(body: PoolIn, user: UserDep, org: LenderDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:  # vault index allocation must be serialised
        p = pools.create(s, chain, user, org, body.model_dump())
        s.commit()
    return _manager_view(s, chain, p)


@router.get("/lender/pools", tags=["lender"])
def my_pools(org: LenderDep, s: SessionDep, chain: ChainDep) -> list[dict]:
    return [public.pool_view(s, chain, p) for p in pools.for_manager(s, org)]


@router.get("/lender/pools/{pool_id}", tags=["lender"])
def my_pool(pool_id: str, org: LenderDep, s: SessionDep, chain: ChainDep) -> dict:
    return _manager_view(s, chain, pools.manage(s, org, pool_id))


@router.patch("/lender/pools/{pool_id}", tags=["lender"])
def edit_pool(pool_id: str, body: PoolPatch, user: UserDep, org: LenderDep, s: SessionDep, chain: ChainDep) -> dict:
    p = pools.update(s, user, org, pools.manage(s, org, pool_id), body.model_dump(exclude_none=True))
    s.commit()
    return _manager_view(s, chain, p)


@router.post("/lender/pools/{pool_id}/fund", tags=["lender"])
def fund_pool(pool_id: str, user: UserDep, org: LenderDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        p = pools.start_funding(s, chain, user, org, pools.manage(s, org, pool_id))
        s.commit()
    return _manager_view(s, chain, p)


@router.post("/lender/pools/{pool_id}/open", tags=["lender"])
def open_pool(pool_id: str, user: UserDep, org: LenderDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        p = pools.open_for_loans(s, user, org, pools.manage(s, org, pool_id))
        s.commit()
    return _manager_view(s, chain, p)


@router.post("/lender/pools/{pool_id}/close", tags=["lender"])
def close_pool(pool_id: str, user: UserDep, org: LenderDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        p = pools.close(s, user, org, pools.manage(s, org, pool_id))
        s.commit()
    return _manager_view(s, chain, p)


# ---------------------------------------------------------------- lender: review queue

class DecisionIn(BaseModel):
    note: str = ""


@router.get("/lender/applications", tags=["lender"])
def review_queue(org: LenderDep, s: SessionDep, status: str | None = None) -> list[dict]:
    return [applications.view(s, a, for_manager=True) for a in applications.for_manager(s, org, status)]


@router.get("/lender/applications/{app_id}", tags=["lender"])
def review_one(app_id: str, org: LenderDep, s: SessionDep) -> dict:
    app = applications.get(s, app_id)
    if s.get(Pool, app.pool_id).manager_org_id != org.id:
        raise Forbidden()
    return applications.view(s, app, for_manager=True)


@router.post("/lender/applications/{app_id}/approve", tags=["lender"])
def approve(app_id: str, body: DecisionIn, user: UserDep, org: LenderDep, s: SessionDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        app = applications.decide(s, user, org, app_id, True, body.note, ctx.settings)
        s.commit()
    return applications.view(s, app, for_manager=True)


@router.post("/lender/applications/{app_id}/decline", tags=["lender"])
def decline(app_id: str, body: DecisionIn, user: UserDep, org: LenderDep, s: SessionDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        app = applications.decide(s, user, org, app_id, False, body.note, ctx.settings)
        s.commit()
    return applications.view(s, app, for_manager=True)


# ---------------------------------------------------------------- lender: funds

class DepositIn(BaseModel):
    tranche: str
    amount: int


class SubmitIn(BaseModel):
    signed_tx_b64: str | None = None


class WithdrawIn(BaseModel):
    tranche: str
    amount: int | None = None


def _intent(d, chain) -> dict:
    return {"id": d.id, "status": d.status, "amount": d.amount, "tranche": d.tranche, "signature": d.signature,
            "explorer_url": explorer_tx(d.signature, chain.cluster) if d.signature else None, "error": d.error}


@router.post("/lender/pools/{pool_id}/deposits/prepare", tags=["lender"])
def prepare_deposit(pool_id: str, body: DepositIn, org: LenderDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        out = funds.prepare_deposit(s, chain, org, pools.get(s, pool_id), body.tranche, body.amount)
        s.commit()
    return out


@router.post("/lender/deposits/{intent_id}/submit", tags=["lender"])
def submit_deposit(intent_id: str, body: SubmitIn, org: LenderDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        d = funds.submit_deposit(s, chain, org, intent_id, body.signed_tx_b64)
    return _intent(d, chain)


@router.get("/lender/deposits/{intent_id}", tags=["lender"])
def deposit_status(intent_id: str, org: LenderDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    from credent.models import DepositIntent

    d = s.get(DepositIntent, intent_id)
    if d is None or d.org_id != org.id:
        raise NotFound("Deposit not found.")
    if d.status == "SUBMITTED":
        with ctx.write_lock:
            funds.confirm_deposit(s, chain, d)
    return _intent(d, chain)


@router.post("/lender/pools/{pool_id}/withdraw", tags=["lender"])
def withdraw(pool_id: str, body: WithdrawIn, org: LenderDep, s: SessionDep, chain: ChainDep, ctx: CtxDep) -> dict:
    with ctx.write_lock:
        out = funds.withdraw(s, chain, org, pools.get(s, pool_id), body.tranche, body.amount)
        s.commit()
        transfers.process(s, chain)
    return out


@router.get("/lender/portfolio", tags=["lender"])
def portfolio(org: LenderDep, s: SessionDep, chain: ChainDep) -> dict:
    positions = funds.portfolio(s, org)
    return {"wallet": funds.balance(s, chain, org), "positions": positions,
            "deployed": sum(p["value"] for p in positions), "pnl": sum(p["pnl"] for p in positions)}


@router.get("/lender/overview", tags=["lender"])
def lender_overview(org: LenderDep, s: SessionDep, chain: ChainDep) -> dict:
    mine = pools.for_manager(s, org)
    queue = applications.for_manager(s, org, "SUBMITTED")
    positions = funds.portfolio(s, org)
    return {"wallet": funds.balance(s, chain, org), "pools": [public.pool_view(s, chain, p) for p in mine],
            "pending_applications": len(queue), "positions": positions,
            "deployed": sum(p["value"] for p in positions), "pnl": sum(p["pnl"] for p in positions),
            "date": clock.iso_date(s, clock.today(s))}


# ---------------------------------------------------------------- notifications

class ReadIn(BaseModel):
    ids: list[int] | None = None


@router.get("/notifications", tags=["notifications"])
def notifications(org: OrgDep, s: SessionDep) -> list[dict]:
    rows = s.exec(select(Notification).where(Notification.org_id == org.id)
                  .order_by(col(Notification.id).desc()).limit(50)).all()
    return [{"id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "href": n.href,
             "created_at": n.created_at.isoformat(), "read_at": n.read_at.isoformat() if n.read_at else None}
            for n in rows]


@router.post("/notifications/read", tags=["notifications"])
def mark_read(body: ReadIn, org: OrgDep, s: SessionDep) -> dict:
    from credent.auth.security import now

    q = select(Notification).where(Notification.org_id == org.id, Notification.read_at.is_(None))
    if body.ids:
        q = q.where(col(Notification.id).in_(body.ids))
    for n in s.exec(q):
        n.read_at = now()
        s.add(n)
    s.commit()
    return {"ok": True}

