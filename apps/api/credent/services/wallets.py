"""Link Solana wallets to an organisation (Sign-In-With-Solana style message), or create a custodial one."""

import secrets
from datetime import timedelta

import base58
from sqlmodel import Session, select

from credent.auth.security import aware, now
from credent.crypto.keys import verify_b58_sig
from credent.errors import InvalidAmount, NotFound, Unauthorized, WalletRequired
from credent.models import Organization, User, Wallet, WalletChallenge
from credent.services import audit
from credent.services.context import Ctx


def _valid(address: str) -> bool:
    try:
        return len(base58.b58decode(address)) == 32
    except ValueError:
        return False


def challenge(s: Session, settings, user: User, org: Organization, address: str) -> str:
    if not _valid(address):
        raise InvalidAmount("That isn't a Solana address.")
    nonce = secrets.token_hex(16)
    host = settings.app_url.split("://")[-1]
    msg = (f"{host} wants you to link your Solana account:\n{address}\n\n"
           f"Link this wallet to {org.name} on Credent.\n\n"
           f"Nonce: {nonce}\nIssued At: {now().isoformat(timespec='seconds')}")
    s.add(WalletChallenge(nonce=nonce, user_id=user.id, address=address, message=msg,
                          expires_at=now() + timedelta(minutes=10)))
    return msg


def verify(s: Session, user: User, org: Organization, address: str, signature: str) -> Wallet:
    ch = s.exec(select(WalletChallenge).where(WalletChallenge.user_id == user.id, WalletChallenge.address == address)
                .order_by(WalletChallenge.expires_at.desc())).first()
    if ch is None or aware(ch.expires_at) < now():
        raise Unauthorized("Request a new signing message and try again.")
    ok = verify_b58_sig(address, ch.message.encode(), signature)
    s.delete(ch)
    if not ok:
        raise Unauthorized("The wallet signature didn't match.")
    existing = s.get(Wallet, address)
    if existing and existing.org_id != org.id:
        raise InvalidAmount("This wallet is already linked to another organisation.")
    w = existing or Wallet(address=address, org_id=org.id, kind="EXTERNAL")
    if not primary(s, org):
        w.is_primary = True
    s.add(w)
    audit.log(s, user.id, org.id, "wallet.link", address)
    return w


def create_custodial(s: Session, ctx: Ctx, world: str, user: User, org: Organization) -> Wallet:
    address = str(ctx.chain(world).owner(f"custodial:{org.id}"))
    w = s.get(Wallet, address) or Wallet(address=address, org_id=org.id, kind="CUSTODIAL")
    if not primary(s, org):
        w.is_primary = True
    s.add(w)
    audit.log(s, user.id, org.id, "wallet.custodial", address)
    return w


def primary(s: Session, org: Organization) -> Wallet | None:
    return s.exec(select(Wallet).where(Wallet.org_id == org.id, Wallet.is_primary)).first()


def require_primary(s: Session, org: Organization) -> Wallet:
    w = primary(s, org)
    if w is None:
        raise WalletRequired()
    return w


def set_primary(s: Session, org: Organization, address: str) -> Wallet:
    target = s.get(Wallet, address)
    if target is None or target.org_id != org.id:
        raise NotFound("Wallet not found.")
    for w in s.exec(select(Wallet).where(Wallet.org_id == org.id)):
        w.is_primary = w.address == address
        s.add(w)
    return target


def remove(s: Session, user: User, org: Organization, address: str) -> None:
    w = s.get(Wallet, address)
    if w is None or w.org_id != org.id:
        raise NotFound("Wallet not found.")
    was_primary = w.is_primary
    s.delete(w)
    s.flush()
    if was_primary:
        nxt = s.exec(select(Wallet).where(Wallet.org_id == org.id)).first()
        if nxt:
            nxt.is_primary = True
            s.add(nxt)
    audit.log(s, user.id, org.id, "wallet.remove", address)


def signer_label(w: Wallet) -> str | None:
    """Custodial wallets are signed by the server; external ones by the user's wallet app."""
    return f"custodial:{w.org_id}" if w.kind == "CUSTODIAL" else None


