"""Users: signup → email verification → login sessions; password reset; profile."""

from email_validator import EmailNotValidError, validate_email
from sqlmodel import Session, select

from credent.auth import security as sec
from credent.config import Settings
from credent.errors import (
    EmailNotVerified,
    EmailTaken,
    InvalidAmount,
    InvalidCredentials,
    NotFound,
    TokenInvalid,
    WeakPassword,
)
from credent.mail import mailer
from credent.models import AuthSession, Membership, Organization, User, Wallet
from credent.services import audit


_DUMMY_HASH = sec.hash_password("credent-timing-equaliser")


def normalize_email(email: str) -> str:
    try:
        return validate_email(email.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError as e:
        raise InvalidAmount(f"That email address doesn't look right: {e}") from e


def by_email(s: Session, email: str) -> User | None:
    return s.exec(select(User).where(User.email == email)).first()


def signup(s: Session, settings: Settings, email: str, password: str, name: str) -> User:
    email = normalize_email(email)
    name = name.strip()
    if not name:
        raise InvalidAmount("Tell us your name.")
    if problem := sec.password_problem(password):
        raise WeakPassword(problem)
    if by_email(s, email):
        raise EmailTaken()
    user = User(email=email, password_hash=sec.hash_password(password), name=name[:80])
    s.add(user)
    s.flush()
    token = sec.issue_token(s, user.id, "VERIFY_EMAIL", hours=24)
    mailer.verify_email(s, settings, email, user.name, token)
    audit.log(s, user.id, None, "user.signup", user.email)
    return user


def resend_verification(s: Session, settings: Settings, email: str) -> None:
    user = by_email(s, normalize_email(email))
    if user and user.email_verified_at is None:  # silent otherwise: don't reveal which emails exist
        mailer.verify_email(s, settings, user.email, user.name, sec.issue_token(s, user.id, "VERIFY_EMAIL", 24))


def verify_email(s: Session, token: str) -> User:
    row = sec.consume_token(s, token, "VERIFY_EMAIL")
    if row is None:
        raise TokenInvalid()
    user = s.get(User, row.user_id)
    if user.email_verified_at is None:
        user.email_verified_at = sec.now()
        s.add(user)
    audit.log(s, user.id, None, "user.verify_email", user.email)
    return user


def login(s: Session, settings: Settings, email: str, password: str, ip: str = "", ua: str = "") -> tuple[User, str]:
    try:
        email = normalize_email(email)
    except InvalidAmount:
        raise InvalidCredentials()
    user = by_email(s, email)
    if user is None:
        sec.check_password(password, _DUMMY_HASH)  # same cost whether or not the account exists
        raise InvalidCredentials()
    if user.disabled or not sec.check_password(password, user.password_hash):
        raise InvalidCredentials()
    if user.email_verified_at is None:
        raise EmailNotVerified()
    user.last_login_at = sec.now()
    s.add(user)
    token = sec.new_session(s, user.id, settings.session_days, ip, ua)
    audit.log(s, user.id, None, "user.login", ip=ip)
    return user, token


def start_session(s: Session, settings: Settings, user: User, ip: str = "", ua: str = "") -> str:
    return sec.new_session(s, user.id, settings.session_days, ip, ua)


def logout(s: Session, token: str | None) -> None:
    row = sec.session_for(s, token)
    if row:
        row.revoked_at = sec.now()
        s.add(row)


def forgot_password(s: Session, settings: Settings, email: str) -> None:
    try:
        user = by_email(s, normalize_email(email))
    except InvalidAmount:
        return
    if user:
        mailer.reset_password(s, settings, user.email, sec.issue_token(s, user.id, "RESET_PASSWORD", hours=1))


def reset_password(s: Session, token: str, password: str) -> None:
    if problem := sec.password_problem(password):
        raise WeakPassword(problem)
    row = sec.consume_token(s, token, "RESET_PASSWORD")
    if row is None:
        raise TokenInvalid()
    user = s.get(User, row.user_id)
    user.password_hash = sec.hash_password(password)
    if user.email_verified_at is None:  # the reset link proves inbox ownership
        user.email_verified_at = sec.now()
    s.add(user)
    for sess in s.exec(select(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))):
        sess.revoked_at = sec.now()
        s.add(sess)
    audit.log(s, user.id, None, "user.reset_password")


def change_password(s: Session, user: User, current: str, new: str, keep: str | None = None) -> None:
    if not sec.check_password(current, user.password_hash):
        raise InvalidCredentials("Your current password is incorrect.")
    if problem := sec.password_problem(new):
        raise WeakPassword(problem)
    user.password_hash = sec.hash_password(new)
    s.add(user)
    for sess in s.exec(select(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))):
        if sess.id_hash != keep:
            sess.revoked_at = sec.now()
            s.add(sess)
    audit.log(s, user.id, None, "user.change_password")


def update_profile(s: Session, user: User, name: str | None) -> User:
    if name is not None:
        if not name.strip():
            raise InvalidAmount("Name can't be empty.")
        user.name = name.strip()[:80]
    s.add(user)
    return user


def sessions(s: Session, user: User, current_hash: str | None) -> list[dict]:
    rows = s.exec(select(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
                  .order_by(AuthSession.created_at.desc())).all()
    return [{"id": r.id_hash[:16], "created_at": r.created_at.isoformat(), "ip": r.ip, "user_agent": r.user_agent,
             "current": r.id_hash == current_hash} for r in rows if sec.aware(r.expires_at) > sec.now()]


def revoke_session(s: Session, user: User, short_id: str) -> None:
    for r in s.exec(select(AuthSession).where(AuthSession.user_id == user.id)):
        if r.id_hash.startswith(short_id) and len(short_id) >= 8:
            r.revoked_at = sec.now()
            s.add(r)
            return
    raise NotFound("Session not found.")


def org_for(s: Session, user: User) -> Organization | None:
    m = s.exec(select(Membership).where(Membership.user_id == user.id)).first()
    return s.get(Organization, m.org_id) if m else None


def me(s: Session, user: User) -> dict:
    from credent.services import orgs  # local import: orgs imports accounts helpers

    org = org_for(s, user)
    wallets = s.exec(select(Wallet).where(Wallet.org_id == org.id)).all() if org else []
    if user.email_verified_at is None:
        step = "verify_email"
    elif org is None:
        step = "role"
    elif not wallets:
        step = "wallet"
    else:
        step = "done"
    membership = s.exec(select(Membership).where(Membership.user_id == user.id)).first()
    return {
        "user": {"id": user.id, "email": user.email, "name": user.name,
                 "email_verified": user.email_verified_at is not None, "avatar_url": user.avatar_url},
        "org": orgs.view(org) if org else None,
        "membership": {"role": membership.role} if membership else None,
        "wallets": [{"address": w.address, "kind": w.kind, "is_primary": w.is_primary,
                     "verified_at": w.verified_at.isoformat()} for w in wallets],
        "onboarding": {"step": step},
    }
