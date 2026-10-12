from fastapi import APIRouter, Request

from credent.api import schemas as S
from credent.api.deps import SessionDep, WalletDep
from credent.services import lender

router = APIRouter(prefix="/lender", tags=["lender"])


@router.post("/faucet")
def faucet(wallet: WalletDep, s: SessionDep, request: Request) -> dict:
    with request.app.state.lock:
        bal = lender.faucet(s, wallet)
        s.commit()
    return {"balance": bal}


@router.post("/deposit")
def deposit(body: S.DepositIn, wallet: WalletDep, s: SessionDep, request: Request) -> dict:
    with request.app.state.lock:
        lender.deposit(s, wallet, body.tranche, body.amount)
        s.commit()
    return lender.positions(s, wallet)


@router.get("/positions")
def positions(wallet: WalletDep, s: SessionDep) -> dict:
    return lender.positions(s, wallet)
