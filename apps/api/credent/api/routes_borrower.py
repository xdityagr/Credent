import csv
import io
import json
from typing import Annotated

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from credent.api import schemas as S
from credent.api.deps import CtxDep, SessionDep, WalletDep
from credent.errors import ReceiptInvalid
from credent.services import borrower

router = APIRouter(prefix="/borrower", tags=["borrower"])


@router.post("/sources/stripe")
def connect_stripe(body: S.ProfileIn, wallet: WalletDep, s: SessionDep, request: Request) -> dict:
    with request.app.state.lock:
        view = borrower.connect_stripe(s, wallet, body.profile)
        s.commit()
    return view


@router.get("/sample-receipts")
def sample_receipts(profile: str, wallet: WalletDep, s: SessionDep, ctx: CtxDep, tampered: bool = False):
    rows = borrower.sample_receipts(s, ctx, wallet, profile, tampered)
    name = f"receipts-{profile}{'-tampered' if tampered else ''}.json"
    return JSONResponse(rows, headers={"Content-Disposition": f'attachment; filename="{name}"'})


def _parse_upload(raw: bytes) -> list[dict]:
    text = raw.decode("utf-8-sig").strip()
    if text.startswith("["):
        try:
            rows = json.loads(text)
        except json.JSONDecodeError as e:
            raise ReceiptInvalid(f"Invalid JSON: {e.msg}.")
        if not isinstance(rows, list):
            raise ReceiptInvalid("Expected a JSON array of receipts.")
        return rows
    return list(csv.DictReader(io.StringIO(text)))


@router.post("/sources/receipts")
async def connect_receipts(wallet: WalletDep, s: SessionDep, ctx: CtxDep, request: Request,
                           file: Annotated[UploadFile, File()], profile: Annotated[str, Form()] = "saas") -> dict:
    rows = _parse_upload(await file.read())
    with request.app.state.lock:
        view = borrower.connect_receipts(s, ctx, wallet, profile, rows)
        s.commit()
    return view


@router.post("/attest")
def attest(wallet: WalletDep, s: SessionDep, ctx: CtxDep, request: Request) -> S.PublicAttestation:
    with request.app.state.lock:
        row = borrower.attest(s, ctx, wallet)
        s.commit()
    return S.PublicAttestation(**row.model_dump(exclude={"borrower_id", "day"}))


@router.post("/prove")
def prove(body: S.ThresholdIn, wallet: WalletDep, s: SessionDep, ctx: CtxDep, request: Request) -> S.ProveOut:
    with request.app.state.lock:
        row = borrower.prove(s, ctx, wallet, body.threshold)
        s.commit()
    return S.ProveOut(proof_id=row.id, threshold=row.threshold, commitment=row.commitment,
                      timings_ms=json.loads(row.timings_json))


@router.post("/credit-line")
def credit_line(wallet: WalletDep, s: SessionDep, request: Request) -> S.CreditLineOut:
    with request.app.state.lock:
        line = borrower.open_credit_line(s, wallet)
        s.commit()
    return S.CreditLineOut(**line.model_dump())


@router.post("/draw")
def draw(body: S.AmountIn, wallet: WalletDep, s: SessionDep, request: Request) -> S.LoanOut:
    with request.app.state.lock:
        loan = borrower.draw(s, wallet, body.amount)
        s.commit()
    return S.LoanOut(**loan.model_dump())


@router.get("/me")
def me(wallet: WalletDep, s: SessionDep) -> dict:
    return borrower.private_view(s, wallet)
