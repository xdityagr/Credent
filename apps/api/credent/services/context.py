import threading
from dataclasses import dataclass, field

from credent.chain.client import ChainClient, LiteChain, RpcChain
from credent.chain.custody import Custody
from credent.chain.service import ChainService
from credent.config import Settings
from credent.crypto.keys import KeyStore
from credent.zk.prover import Prover


@dataclass
class Ctx:
    settings: Settings
    keys: KeyStore
    prover: Prover
    client: ChainClient | None = None
    write_lock: threading.RLock = field(default_factory=threading.RLock)
    _chains: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.client is None:
            self.client = (LiteChain() if self.settings.chain_mode == "local"
                           else RpcChain(self.settings.solana_rpc_url))
        self.custody = Custody(self.keys)

    def chain(self, world: str) -> ChainService:
        if world not in self._chains:
            self._chains[world] = ChainService(self.client, self.custody, world)
        return self._chains[world]
