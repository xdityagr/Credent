"""Noir + Barretenberg prover, run in the pinned docker image (or locally via the same script)."""

import base64
import json
import os
import secrets
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

from credent.config import REPO_ROOT, Settings
from credent.errors import ProverUnavailable, ThresholdNotMet
from credent.zk.encode import normalize_field_hex, prover_toml

SCRIPT = REPO_ROOT / "infra" / "prover" / "credent-prove.sh"
SETUP_HINT = (
    "Start Docker Desktop, then build the prover image from the repo root: "
    "docker build -f infra/prover/Dockerfile -t credent-prover ."
)


@dataclass(frozen=True)
class ProofArtifacts:
    proof_b64: str
    public_inputs_b64: str
    vk_b64: str
    timings_ms: dict[str, int] = field(default_factory=dict)


class Prover(Protocol):
    def ensure_available(self) -> None: ...
    def commit(self, daily: list[int], salt: str) -> str: ...
    def prove(self, daily: list[int], salt: str, threshold: int) -> ProofArtifacts: ...
    def verify(self, a: ProofArtifacts) -> bool: ...


def new_salt() -> str:
    """Random field element (< 2^248, safely below the BN254 modulus)."""
    return str(secrets.randbits(248))


class DockerRunner:
    def __init__(self, image: str):
        self.image = image

    def available(self) -> str | None:
        if not shutil.which("docker"):
            return "Docker is not installed or not on PATH. " + SETUP_HINT
        r = subprocess.run(["docker", "image", "inspect", self.image], capture_output=True)
        if r.returncode != 0:
            return f"Prover image '{self.image}' not found (or Docker is not running). " + SETUP_HINT
        return None

    def run(self, mode: str, workdir: Path) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["docker", "run", "--rm", "-v", f"{workdir}:/work", self.image, mode],
            capture_output=True, text=True, timeout=180,
        )


class LocalRunner:
    """Runs the same script with nargo/bb from PATH. Needs `nargo compile` + `bb write_vk` done in circuit_dir."""

    def __init__(self, circuit_dir: Path):
        self.circuit_dir = circuit_dir

    def available(self) -> str | None:
        missing = [t for t in ("bash", "nargo", "bb") if not shutil.which(t)]
        if missing:
            return f"Missing tools on PATH: {', '.join(missing)}. Use PROVER=docker instead."
        if not (self.circuit_dir / "target" / "vk" / "vk").exists():
            return "Compile the circuit first: nargo compile && bb write_vk -b target/revenue_proof.json -o target/vk"
        return None

    def run(self, mode: str, workdir: Path) -> subprocess.CompletedProcess:
        env = {"CREDENT_CIRCUIT": str(self.circuit_dir), "CREDENT_WORK": str(workdir)}
        return subprocess.run(["bash", str(SCRIPT), mode], capture_output=True, text=True,
                              timeout=180, env={**os.environ, **env})


class NoirProver:
    def __init__(self, runner: DockerRunner | LocalRunner):
        self.runner = runner

    def ensure_available(self) -> None:
        problem = self.runner.available()
        if problem:
            raise ProverUnavailable(problem)

    def _run(self, mode: str, workdir: Path) -> subprocess.CompletedProcess:
        self.ensure_available()
        try:
            return self.runner.run(mode, workdir)
        except subprocess.TimeoutExpired:
            raise ProverUnavailable("The prover timed out.")

    def commit(self, daily: list[int], salt: str) -> str:
        with tempfile.TemporaryDirectory(prefix="credent-") as tmp:
            work = Path(tmp)
            (work / "Prover.toml").write_text(prover_toml(daily, salt, 0), newline="\n")
            r = self._run("commit", work)
            if r.returncode != 0:
                raise ProverUnavailable(f"Commitment failed: {r.stderr.strip()[-400:]}")
            return normalize_field_hex((work / "commitment").read_text().strip())

    def prove(self, daily: list[int], salt: str, threshold: int) -> ProofArtifacts:
        with tempfile.TemporaryDirectory(prefix="credent-") as tmp:
            work = Path(tmp)
            (work / "Prover.toml").write_text(prover_toml(daily, salt, threshold), newline="\n")
            r = self._run("prove", work)
            if r.returncode != 0:
                if "Cannot satisfy constraint" in r.stderr or "assert" in r.stderr.lower():
                    raise ThresholdNotMet()
                raise ProverUnavailable(f"Proving failed: {r.stderr.strip()[-400:]}")
            out = work / "out"
            b64 = lambda name: base64.b64encode((out / name).read_bytes()).decode()  # noqa: E731
            timings = json.loads((out / "timings.json").read_text()) if (out / "timings.json").exists() else {}
            return ProofArtifacts(b64("proof"), b64("public_inputs"), b64("vk"), timings)

    def verify(self, a: ProofArtifacts) -> bool:
        with tempfile.TemporaryDirectory(prefix="credent-") as tmp:
            work = Path(tmp)
            (work / "proof").write_bytes(base64.b64decode(a.proof_b64))
            (work / "public_inputs").write_bytes(base64.b64decode(a.public_inputs_b64))
            (work / "vk").write_bytes(base64.b64decode(a.vk_b64))
            return self._run("verify", work).returncode == 0


def get_prover(settings: Settings) -> NoirProver:
    if settings.prover == "local":
        return NoirProver(LocalRunner(settings.circuit_dir))
    return NoirProver(DockerRunner(settings.prover_image))
