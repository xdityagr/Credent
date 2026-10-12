from dataclasses import dataclass

from credent.config import Settings
from credent.crypto.keys import KeyStore
from credent.zk.prover import Prover


@dataclass
class Ctx:
    settings: Settings
    keys: KeyStore
    prover: Prover
