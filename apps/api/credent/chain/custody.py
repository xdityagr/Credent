"""Server custody: every protocol keypair is derived from one master secret.

Nothing per-key is persisted. Labels scoped by `world` (regenerated on a world
reset) get a fresh mint and fresh vaults; the fee payer is world-independent so
its SOL balance survives resets.
"""

import hashlib
import hmac

from solders.keypair import Keypair

from credent.crypto.keys import KeyStore


class Custody:
    def __init__(self, keys: KeyStore):
        self._master = bytes(keys.get("custody-master"))

    def derive(self, label: str) -> Keypair:
        seed = hmac.new(self._master, label.encode(), hashlib.sha512).digest()[:32]
        return Keypair.from_seed(seed)

    def fee_payer(self) -> Keypair:
        return self.derive("fee-payer")

    def world(self, world: str, label: str) -> Keypair:
        return self.derive(f"{world}:{label}")
