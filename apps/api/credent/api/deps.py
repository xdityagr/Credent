from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlmodel import Session

from credent.errors import SimDisabled, Unauthorized
from credent.services import auth
from credent.services.context import Ctx


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine, expire_on_commit=False) as s:
        try:
            yield s
        except Exception:
            s.rollback()
            raise


def get_ctx(request: Request) -> Ctx:
    return request.app.state.ctx


def get_wallet(session: Annotated[Session, Depends(get_session)],
               authorization: Annotated[str | None, Header()] = None) -> str:
    token = authorization.removeprefix("Bearer ").strip() if authorization else None
    wallet = auth.wallet_for(session, token)
    if wallet is None:
        raise Unauthorized()
    return wallet


def require_sim(ctx: Annotated[Ctx, Depends(get_ctx)]) -> None:
    if not ctx.settings.sim_enabled:
        raise SimDisabled()


SessionDep = Annotated[Session, Depends(get_session)]
CtxDep = Annotated[Ctx, Depends(get_ctx)]
WalletDep = Annotated[str, Depends(get_wallet)]
