from fastapi import APIRouter

from credent.api import schemas as S
from credent.api.deps import SessionDep, WalletDep
from credent.services import auth, borrower

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/challenge")
def challenge(body: S.ChallengeIn, s: SessionDep) -> dict:
    return {"message": auth.challenge(s, body.wallet)}


@router.post("/verify")
def verify(body: S.VerifyIn, s: SessionDep) -> S.SessionOut:
    return S.SessionOut(token=auth.verify(s, body.wallet, body.signature), wallet=body.wallet, demo=False)


@router.post("/demo")
def demo(s: SessionDep) -> S.SessionOut:
    wallet, token = auth.demo(s)
    return S.SessionOut(token=token, wallet=wallet, demo=True)


@router.get("/me")
def me(wallet: WalletDep, s: SessionDep) -> S.MeOut:
    b = borrower.get(s, wallet)
    return S.MeOut(wallet=wallet, borrower_id=b.id if b else None)
