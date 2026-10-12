"""Test-only deterministic prover. Never wired into the application config."""

import base64
import hashlib
import json

from credent.errors import ThresholdNotMet
from credent.zk.prover import ProofArtifacts


class FakeProver:
    def ensure_available(self) -> None:
        pass

    def commit(self, daily: list[int], salt: str) -> str:
        return "0x" + hashlib.sha256(json.dumps([daily, salt]).encode()).hexdigest()

    def prove(self, daily: list[int], salt: str, threshold: int) -> ProofArtifacts:
        if sum(daily) < threshold:
            raise ThresholdNotMet()
        pi = threshold.to_bytes(32, "big") + bytes.fromhex(self.commit(daily, salt)[2:])
        return ProofArtifacts(
            proof_b64=base64.b64encode(hashlib.sha256(pi + b"fake").digest()).decode(),
            public_inputs_b64=base64.b64encode(pi).decode(),
            vk_b64=base64.b64encode(b"fake-vk").decode(),
            timings_ms={"witness": 1, "prove": 1, "verify": 1},
        )

    def verify(self, a: ProofArtifacts) -> bool:
        pi = base64.b64decode(a.public_inputs_b64)
        return base64.b64decode(a.proof_b64) == hashlib.sha256(pi + b"fake").digest()
