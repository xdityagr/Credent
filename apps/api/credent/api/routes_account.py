"""Auth, profile, organisation and wallet routes."""

from typing import Annotated

from fastapi import APIRouter, File, Request, Response, UploadFile
from pydantic import BaseModel, Field

from credent.mail import mailer
from credent.api.deps import (
    AuthDep,
    ChainDep,
    CtxDep,
    OrgDep,
    SessionDep,
    UserDep,
    client_ip,
    limiter,
)
from credent.auth.security import SESSION_COOKIE
from credent.errors import Forbidden, NotFound
from credent.services import accounts, clock, orgs, public, sim, wallets

router = APIRouter()


class SignupIn(BaseModel):
    email: str
    password: str
    name: str


class EmailIn(BaseModel):
    email: str


class LoginIn(BaseModel):
    email: str
    password: str


class TokenIn(BaseModel):
    token: str


class ResetIn(BaseModel):
    token: str
    password: str


class DemoIn(BaseModel):
    role: str = "borrower"


class ProfileIn(BaseModel):
    name: str | None = None


class PasswordIn(BaseModel):
    current: str
    new: str


class OrgIn(BaseModel):
    kind: str
    name: str
    website: str = ""
    sector: str = ""
    country: str = ""
    description: str = ""


class OrgPatch(BaseModel):
    name: str | None = None
    website: str | None = None
    sector: str | None = None
    country: str | None = None
    description: str | None = None


class AddressIn(BaseModel):
    address: str


class WalletVerifyIn(BaseModel):
    address: str
    signature: str
    provider: str | None = Field(default=None, max_length=40)


class WalletPatchIn(BaseModel):
    is_primary: bool | None = None
    provider: str | None = Field(default=None, max_length=40)  # display label, e.g. "Phantom"


def _set_cookie(response: Response, request: Request, token: str) -> None:
    settings = request.app.state.ctx.settings
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", secure=settings.cookie_secure,
                        max_age=settings.session_days * 86400, path="/")


# ---------------------------------------------------------------- auth

@router.post("/auth/signup", status_code=201, tags=["auth"])
def signup(body: SignupIn, request: Request, s: SessionDep, ctx: CtxDep) -> dict:
    limiter.check(f"signup:{client_ip(request)}", 10, 3600)
    accounts.signup(s, ctx.settings, body.email, body.password, body.name)
    s.commit()
    return {"ok": True}


@router.post("/auth/verify-email", tags=["auth"])
def verify_email(body: TokenIn, request: Request, response: Response, s: SessionDep, ctx: CtxDep) -> dict:
    user = accounts.verify_email(s, body.token)
    token = accounts.start_session(s, ctx.settings, user, client_ip(request), request.headers.get("user-agent", ""))
    s.commit()
    _set_cookie(response, request, token)  # the link proves inbox ownership: sign them straight in
    return accounts.me(s, user)


@router.post("/auth/resend-verification", tags=["auth"])
def resend(body: EmailIn, request: Request, s: SessionDep, ctx: CtxDep) -> dict:
    limiter.check(f"resend:{client_ip(request)}", 5, 600)
    accounts.resend_verification(s, ctx.settings, body.email)
    s.commit()
    return {"ok": True}


@router.post("/auth/login", tags=["auth"])
def login(body: LoginIn, request: Request, response: Response, s: SessionDep, ctx: CtxDep) -> dict:
    limiter.check(f"login:{client_ip(request)}", 20, 600)
    limiter.check(f"login-account:{body.email.strip().lower()}", 10, 600)
    user, token = accounts.login(s, ctx.settings, body.email, body.password, client_ip(request),
                                 request.headers.get("user-agent", ""))
    s.commit()
    _set_cookie(response, request, token)
    return accounts.me(s, user)


@router.post("/auth/logout", tags=["auth"])
def logout(request: Request, response: Response, s: SessionDep) -> dict:
    accounts.logout(s, request.cookies.get(SESSION_COOKIE))
    s.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.post("/auth/forgot-password", tags=["auth"])
def forgot(body: EmailIn, request: Request, s: SessionDep, ctx: CtxDep) -> dict:
    limiter.check(f"forgot:{client_ip(request)}", 5, 600)
    accounts.forgot_password(s, ctx.settings, body.email)
    s.commit()
    return {"ok": True}  # same answer whether or not the email exists


@router.post("/auth/reset-password", tags=["auth"])
def reset(body: ResetIn, s: SessionDep, ctx: CtxDep) -> dict:
    user = accounts.reset_password(s, body.token, body.password)
    mailer.password_changed(s, ctx.settings, user.email, user.name)
    s.commit()
    return {"ok": True}


@router.post("/auth/demo", tags=["auth"])
def demo(body: DemoIn, request: Request, response: Response, s: SessionDep, ctx: CtxDep) -> dict:
    if not ctx.settings.sim_enabled:
        raise Forbidden("The demo is turned off on this deployment.")
    user = sim.demo_user(s, body.role)
    token = accounts.start_session(s, ctx.settings, user, client_ip(request), request.headers.get("user-agent", ""))
    s.commit()
    _set_cookie(response, request, token)
    return accounts.me(s, user)


# ---------------------------------------------------------------- me

@router.get("/me", tags=["me"])
def me(user: UserDep, s: SessionDep) -> dict:
    return accounts.me(s, user)


@router.patch("/me", tags=["me"])
def update_me(body: ProfileIn, user: UserDep, s: SessionDep) -> dict:
    accounts.update_profile(s, user, body.name)
    s.commit()
    return accounts.me(s, user)


@router.post("/me/password", tags=["me"])
def change_password(body: PasswordIn, user: UserDep, auth: AuthDep, s: SessionDep, ctx: CtxDep) -> dict:
    accounts.change_password(s, user, body.current, body.new, keep=auth.id_hash)
    mailer.password_changed(s, ctx.settings, user.email, user.name)
    s.commit()
    return {"ok": True}


@router.get("/me/sessions", tags=["me"])
def my_sessions(user: UserDep, auth: AuthDep, s: SessionDep) -> list[dict]:
    return accounts.sessions(s, user, auth.id_hash)


@router.delete("/me/sessions/{sid}", tags=["me"])
def revoke(sid: str, user: UserDep, s: SessionDep) -> dict:
    accounts.revoke_session(s, user, sid)
    s.commit()
    return {"ok": True}


# ---------------------------------------------------------------- organisations

@router.post("/orgs", status_code=201, tags=["orgs"])
def create_org(body: OrgIn, user: UserDep, s: SessionDep) -> dict:
    org = orgs.create(s, user, body.kind, body.model_dump(exclude={"kind"}))
    s.commit()
    return orgs.view(org)


@router.patch("/orgs/me", tags=["orgs"])
def update_org(body: OrgPatch, user: UserDep, org: OrgDep, s: SessionDep) -> dict:
    orgs.update(s, user, org, body.model_dump(exclude_none=True))
    s.commit()
    return orgs.view(org)


@router.post("/orgs/me/logo", tags=["orgs"])
async def upload_logo(user: UserDep, org: OrgDep, s: SessionDep, ctx: CtxDep,
                      file: Annotated[UploadFile, File()]) -> dict:
    data = await file.read(1_000_001)
    orgs.set_logo(s, ctx.settings.data_dir / "uploads", org, file.content_type or "", data)
    s.commit()
    return orgs.view(org)


@router.get("/orgs/{slug}", tags=["orgs"])
def org_profile(slug: str, s: SessionDep, chain: ChainDep) -> dict:
    return public.lender_profile(s, chain, slug)


# ---------------------------------------------------------------- wallets

@router.post("/wallets/challenge", tags=["wallets"])
def wallet_challenge(body: AddressIn, user: UserDep, org: OrgDep, s: SessionDep, ctx: CtxDep) -> dict:
    msg = wallets.challenge(s, ctx.settings, user, org, body.address)
    s.commit()
    return {"message": msg}


@router.post("/wallets/verify", tags=["wallets"])
def wallet_verify(body: WalletVerifyIn, user: UserDep, org: OrgDep, s: SessionDep, ctx: CtxDep) -> dict:
    first = wallets.primary(s, org) is None
    w = wallets.verify(s, user, org, body.address, body.signature, body.provider)
    if first:
        mailer.welcome(s, ctx.settings, user.email, user.name, org.name, org.kind, org.pseudonym)
    s.commit()
    return _wallet(w)


@router.post("/wallets/custodial", tags=["wallets"])
def wallet_custodial(user: UserDep, org: OrgDep, s: SessionDep, ctx: CtxDep) -> dict:
    first = wallets.primary(s, org) is None
    w = wallets.create_custodial(s, ctx, clock.world(s), user, org)
    if first:
        mailer.welcome(s, ctx.settings, user.email, user.name, org.name, org.kind, org.pseudonym)
    s.commit()
    return _wallet(w)


@router.patch("/wallets/{address}", tags=["wallets"])
def wallet_update(address: str, body: WalletPatchIn, org: OrgDep, s: SessionDep) -> dict:
    if body.is_primary is False:
        raise NotFound("Choose a different wallet as primary instead.")
    w = wallets.set_primary(s, org, address) if body.is_primary else wallets.get_own(s, org, address)
    if body.provider and w.kind == "EXTERNAL":
        w.provider = " ".join(body.provider.split())[:40] or None
        s.add(w)
    s.commit()
    return _wallet(w)


@router.delete("/wallets/{address}", tags=["wallets"])
def wallet_remove(address: str, user: UserDep, org: OrgDep, s: SessionDep) -> dict:
    wallets.remove(s, user, org, address)
    s.commit()
    return {"ok": True}


def _wallet(w) -> dict:
    return {"address": w.address, "kind": w.kind, "provider": w.provider, "is_primary": w.is_primary,
            "verified_at": w.verified_at.isoformat()}
