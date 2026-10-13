"""ed25519 keys (Solana-compatible base58 public keys)."""

import base64
import binascii
import hashlib
from pathlib import Path

import base58
from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey


class KeyStore:
    """One 32-byte seed per named key.

    With `secret` set (KEY_SECRET in production), every key is derived from it,
    so hosts with ephemeral disks keep the same custody, notary and anchor keys
    across deploys. Otherwise seeds are generated once and persisted under `dir`.
    """

    def __init__(self, dir: Path | str, secret: str = ""):
        self.dir = Path(dir)
        self.secret = secret

    def get(self, name: str) -> SigningKey:
        if self.secret:
            return SigningKey(hashlib.sha256(f"credent-key:{name}:{self.secret}".encode()).digest())
        path = self.dir / f"{name}.key"
        if path.exists():
            return SigningKey(bytes.fromhex(path.read_text().strip()))
        self.dir.mkdir(parents=True, exist_ok=True)
        key = SigningKey.generate()
        path.write_text(bytes(key).hex())
        return key


def pubkey_b58(key: SigningKey) -> str:
    return base58.b58encode(bytes(key.verify_key)).decode()


def sign_b64(key: SigningKey, data: bytes) -> str:
    return base64.b64encode(key.sign(data).signature).decode()


def verify_b64(pubkey: str, data: bytes, sig_b64: str) -> bool:
    try:
        VerifyKey(base58.b58decode(pubkey)).verify(data, base64.b64decode(sig_b64, validate=True))
        return True
    except (BadSignatureError, ValueError, binascii.Error):
        return False


def verify_b58_sig(pubkey: str, data: bytes, sig_b58: str) -> bool:
    """Verify a base58-encoded signature (what Solana wallets produce)."""
    try:
        VerifyKey(base58.b58decode(pubkey)).verify(data, base58.b58decode(sig_b58))
        return True
    except (BadSignatureError, ValueError):
        return False
