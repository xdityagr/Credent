"""Simulated zkTLS notary.

In production a TLS notary (TLSNotary / Reclaim / Opacity) witnesses the
borrower's session with their payment processor. Here the notary receives the
revenue series directly and signs only the commitment to it, so nothing
downstream ever needs the raw numbers.
"""

import hashlib
from dataclasses import asdict, dataclass

from nacl.signing import SigningKey

from credent.crypto.canonical import canonical_json
from credent.crypto.keys import pubkey_b58, sign_b64, verify_b64


@dataclass(frozen=True)
class Attestation:
    id: str
    source: str
    period_start: int
    period_end: int
    account_hash: str
    commitment: str
    notary_pubkey: str
    signature: str

    def message(self) -> bytes:
        d = asdict(self)
        d.pop("id")
        d.pop("signature")
        return canonical_json(d).encode()


def attest(source: str, period_start: int, period_end: int, account_ref: str,
           commitment: str, notary_key: SigningKey) -> Attestation:
    unsigned = Attestation(
        id="",
        source=source,
        period_start=period_start,
        period_end=period_end,
        account_hash=hashlib.sha256(f"credent-account:{account_ref}".encode()).hexdigest(),
        commitment=commitment,
        notary_pubkey=pubkey_b58(notary_key),
        signature="",
    )
    msg = unsigned.message()
    return Attestation(**{
        **asdict(unsigned),
        "id": "att_" + hashlib.sha256(msg).hexdigest()[:16],
        "signature": sign_b64(notary_key, msg),
    })


def verify_attestation(a: Attestation) -> bool:
    return verify_b64(a.notary_pubkey, a.message(), a.signature)
