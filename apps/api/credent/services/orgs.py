"""Organisations: the borrower or lender company a user acts for."""

import re
import secrets
from pathlib import Path

from sqlmodel import Session, select

from credent.errors import Forbidden, InvalidAmount, NotFound, OnboardingRequired
from credent.models import Membership, Organization, User
from credent.services import audit

KINDS = ("BORROWER", "LENDER")
LOGO_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
MAX_LOGO = 1_000_000


def view(o: Organization) -> dict:
    return {"id": o.id, "kind": o.kind, "name": o.name, "slug": o.slug, "website": o.website,
            "sector": o.sector, "country": o.country, "description": o.description,
            "logo_url": f"/api/uploads/{o.logo_path}" if o.logo_path else None,
            "pseudonym": o.pseudonym, "is_demo": o.is_demo}


def _slug(s: Session, name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "org"
    slug, n = base, 2
    while s.exec(select(Organization).where(Organization.slug == slug)).first():
        slug, n = f"{base}-{n}", n + 1
    return slug


def _pseudonym(s: Session, kind: str) -> str:
    prefix = "BRW" if kind == "BORROWER" else "LND"
    while True:
        p = f"{prefix}-{secrets.token_hex(3).upper()}"
        if not s.exec(select(Organization).where(Organization.pseudonym == p)).first():
            return p


def _clean(fields: dict) -> dict:
    out = {}
    for k, limit in (("name", 80), ("website", 200), ("sector", 60), ("country", 60), ("description", 1200)):
        if k in fields and fields[k] is not None:
            out[k] = str(fields[k]).strip()[:limit]
    if "website" in out and out["website"] and not re.match(r"^https?://", out["website"]):
        out["website"] = "https://" + out["website"]
    return out


def create(s: Session, user: User, kind: str, fields: dict, is_demo: bool = False) -> Organization:
    from credent.services.accounts import org_for

    if user.email_verified_at is None:
        raise Forbidden("Verify your email first.")
    if org_for(s, user):
        raise InvalidAmount("You already belong to an organisation.")
    kind = kind.upper()
    if kind not in KINDS:
        raise InvalidAmount("Choose Borrower or Lender.")
    data = _clean(fields)
    if not data.get("name"):
        raise InvalidAmount("Company name is required.")
    org = Organization(kind=kind, slug=_slug(s, data["name"]), pseudonym=_pseudonym(s, kind), is_demo=is_demo, **data)
    s.add(org)
    s.flush()
    s.add(Membership(user_id=user.id, org_id=org.id, role="OWNER"))
    audit.log(s, user.id, org.id, "org.create", org.name, kind=kind)
    return org


def update(s: Session, user: User, org: Organization, fields: dict) -> Organization:
    data = _clean(fields)
    if "name" in data and not data["name"]:
        raise InvalidAmount("Company name can't be empty.")
    for k, v in data.items():
        setattr(org, k, v)
    s.add(org)
    audit.log(s, user.id, org.id, "org.update", **data)
    return org


def set_logo(s: Session, uploads: Path, org: Organization, content_type: str, data: bytes) -> Organization:
    ext = LOGO_TYPES.get(content_type)
    if ext is None:
        raise InvalidAmount("Upload a PNG, JPG or WebP image.")
    if len(data) > MAX_LOGO:
        raise InvalidAmount("Logo must be under 1 MB.")
    magic = {"png": b"\x89PNG", "jpg": b"\xff\xd8", "webp": b"RIFF"}[ext]
    if not data.startswith(magic):
        raise InvalidAmount("That file isn't a valid image.")
    rel = f"logos/{org.id}-{secrets.token_hex(4)}.{ext}"
    path = uploads / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    org.logo_path = rel
    s.add(org)
    return org


def require(s: Session, user: User, kind: str | None = None) -> Organization:
    from credent.services.accounts import org_for

    org = org_for(s, user)
    if org is None:
        raise OnboardingRequired()
    if kind and org.kind != kind:
        raise Forbidden(f"This is only available to {kind.lower()} organisations.")
    return org


def by_slug(s: Session, slug: str) -> Organization:
    org = s.exec(select(Organization).where(Organization.slug == slug)).first()
    if org is None:
        raise NotFound("Organisation not found.")
    return org


def owners(s: Session, org_id: str) -> list[User]:
    ids = [m.user_id for m in s.exec(select(Membership).where(Membership.org_id == org_id))]
    return [s.get(User, i) for i in ids]
