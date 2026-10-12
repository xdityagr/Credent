"""Sign-in with a Solana wallet (ed25519 message signature), plus server-held demo wallets."""

import secrets

import base58
from nacl.signing import SigningKey
from sqlmodel import Session

from credent.crypto.keys import pubkey_b58, verify_b58_sig
from credent.errors import Unauthorized
from credent.models import AuthSession, Challenge


def _message(wallet: str, nonce: str) -> str:
    return f"Sign in to Credent\n\nWallet: {wallet}\nNonce: {nonce}"


def _valid_wallet(wallet: str) -> bool:
    try:
        return len(base58.b58decode(wallet)) == 32
    except ValueError:
        return False


def challenge(s: Session, wallet: str) -> str:
    if not _valid_wallet(wallet):
        raise Unauthorized("Not a valid Solana address.")
    nonce = secrets.token_hex(16)
    row = s.get(Challenge, wallet) or Challenge(wallet=wallet, nonce=nonce)
    row.nonce = nonce
    s.add(row)
    s.commit()
    return _message(wallet, nonce)


def _issue(s: Session, wallet: str, demo: bool) -> str:
    token = secrets.token_urlsafe(24)
    s.add(AuthSession(token=token, wallet=wallet, demo=demo))
    s.commit()
    return token


def verify(s: Session, wallet: str, signature_b58: str) -> str:
    row = s.get(Challenge, wallet)
    if row is None:
        raise Unauthorized("Request a sign-in challenge first.")
    ok = verify_b58_sig(wallet, _message(wallet, row.nonce).encode(), signature_b58)
    s.delete(row)
    s.commit()
    if not ok:
        raise Unauthorized("Wallet signature did not verify.")
    return _issue(s, wallet, demo=False)


def demo(s: Session) -> tuple[str, str]:
    wallet = pubkey_b58(SigningKey.generate())
    return wallet, _issue(s, wallet, demo=True)


def wallet_for(s: Session, token: str | None) -> str | None:
    if not token:
        return None
    row = s.get(AuthSession, token)
    return row.wallet if row else None
