import threading
import time
from collections import defaultdict
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlmodel import Session

from credent.auth.security import SESSION_COOKIE, session_for
from credent.chain.service import ChainService
from credent.errors import Forbidden, RateLimited, Unauthorized
from credent.models import AuthSession, Organization, User
from credent.services import clock, orgs
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


SessionDep = Annotated[Session, Depends(get_session)]
CtxDep = Annotated[Ctx, Depends(get_ctx)]


def get_chain(s: SessionDep, ctx: CtxDep) -> ChainService:
    return ctx.chain(clock.world(s))


ChainDep = Annotated[ChainService, Depends(get_chain)]


def get_auth(request: Request, s: SessionDep) -> AuthSession:
    row = session_for(s, request.cookies.get(SESSION_COOKIE))
    if row is None:
        raise Unauthorized("Sign in to continue.")
    return row


AuthDep = Annotated[AuthSession, Depends(get_auth)]


def get_user(auth: AuthDep, s: SessionDep) -> User:
    user = s.get(User, auth.user_id)
    if user is None or user.disabled:
        raise Unauthorized("Sign in to continue.")
    return user


UserDep = Annotated[User, Depends(get_user)]


def get_org(user: UserDep, s: SessionDep) -> Organization:
    return orgs.require(s, user)


def get_borrower(user: UserDep, s: SessionDep) -> Organization:
    return orgs.require(s, user, "BORROWER")


def get_lender(user: UserDep, s: SessionDep) -> Organization:
    return orgs.require(s, user, "LENDER")


OrgDep = Annotated[Organization, Depends(get_org)]
BorrowerDep = Annotated[Organization, Depends(get_borrower)]
LenderDep = Annotated[Organization, Depends(get_lender)]


def require_demo(org: OrgDep, ctx: CtxDep) -> Organization:
    if not ctx.settings.sim_enabled or not org.is_demo:
        raise Forbidden("Simulation controls are only available in demo organisations.")
    return org


def client_ip(request: Request) -> str:
    return request.client.host if request.client else ""


class RateLimiter:
    """Small in-memory sliding window (per key). Enough for a single API process."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window: float) -> None:
        now = time.monotonic()
        with self._lock:
            hits = [t for t in self._hits[key] if now - t < window]
            if len(hits) >= limit:
                raise RateLimited()
            hits.append(now)
            self._hits[key] = hits


limiter = RateLimiter()
