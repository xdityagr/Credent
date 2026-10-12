"""Real Noir/bb proofs through the docker image. Run with: uv run pytest -m prover"""

import base64
from dataclasses import replace

import pytest

from credent.errors import ThresholdNotMet
from credent.zk.encode import parse_public_inputs
from credent.zk.prover import DockerRunner, NoirProver

pytestmark = pytest.mark.prover

DAILY = [100_000 + i * 137 for i in range(90)]
SALT = "123456789"


@pytest.fixture(scope="module")
def prover():
    p = NoirProver(DockerRunner("credent-prover"))
    p.ensure_available()
    return p


def test_commit_prove_verify(prover):
    commitment = prover.commit(DAILY, SALT)
    art = prover.prove(DAILY, SALT, 5_000_000)
    threshold, pi_commitment = parse_public_inputs(base64.b64decode(art.public_inputs_b64))
    assert threshold == 5_000_000
    assert pi_commitment == commitment
    assert set(art.timings_ms) == {"witness", "prove", "verify"}
    assert prover.verify(art)


def test_threshold_not_met(prover):
    with pytest.raises(ThresholdNotMet):
        prover.prove(DAILY, SALT, sum(DAILY) + 1)


def test_tampered_public_inputs_fail(prover):
    art = prover.prove(DAILY, SALT, 5_000_000)
    raw = bytearray(base64.b64decode(art.public_inputs_b64))
    raw[31] ^= 1  # change the threshold
    bad = replace(art, public_inputs_b64=base64.b64encode(bytes(raw)).decode())
    assert not prover.verify(bad)


def test_canonical_vk_matches_proof_vk(prover):
    art = prover.prove(DAILY, SALT, 5_000_000)
    assert prover.vk_b64() == art.vk_b64
