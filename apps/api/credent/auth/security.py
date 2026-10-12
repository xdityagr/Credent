"""Passwords (argon2id), opaque session tokens, single-use email tokens."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlmodel import Session

from credent.models import AuthSession, AuthToken

_ph = PasswordHasher()
SESSION_COOKIE = "credent_session"


def now() -> datetime:
    return datetime.now(timezone.utc)


def aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def sha(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def check_password(pw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, pw)
    except (VerificationError, InvalidHashError):
        return False


def password_problem(pw: str) -> str | None:
    if len(pw) < 10:
        return "Use at least 10 characters."
    if pw.lower() == pw or pw.upper() == pw or not any(c.isdigit() for c in pw):
        return "Mix upper and lower case letters and at least one number."
    return None


def new_session(s: Session, user_id: str, days: int, ip: str = "", ua: str = "") -> str:
    token = secrets.token_urlsafe(32)
    s.add(AuthSession(id_hash=sha(token), user_id=user_id, expires_at=now() + timedelta(days=days),
                      ip=ip[:64], user_agent=ua[:256]))
    return token


def session_for(s: Session, token: str | None) -> AuthSession | None:
    if not token:
        return None
    row = s.get(AuthSession, sha(token))
    if row is None or row.revoked_at is not None or aware(row.expires_at) < now():
        return None
    return row


def issue_token(s: Session, user_id: str, purpose: str, hours: int) -> str:
    token = secrets.token_urlsafe(32)
    s.add(AuthToken(hash=sha(token), user_id=user_id, purpose=purpose, expires_at=now() + timedelta(hours=hours)))
    return token


def consume_token(s: Session, token: str, purpose: str) -> AuthToken | None:
    row = s.get(AuthToken, sha(token or ""))
    if row is None or row.purpose != purpose or row.used_at is not None or aware(row.expires_at) < now():
        return None
    row.used_at = now()
    s.add(row)
    return row
