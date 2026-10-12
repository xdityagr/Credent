import httpx
import pytest
from fastapi.testclient import TestClient

from credent.anchor import SolanaAnchor
from credent.api.app import create_app
from credent.config import Settings
from credent.crypto.keys import KeyStore
from tests.fakes import FakeProver


@pytest.fixture
def app(tmp_path):
    settings = Settings(data_dir=tmp_path, anchor_enabled=False,
                        database_url=f"sqlite:///{(tmp_path / 'api.db').as_posix()}")
    anchor = SolanaAnchor(settings, KeyStore(tmp_path / "keys"),
                          http=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500))))
    return create_app(settings, prover=FakeProver(), anchor=anchor, background=False)


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def seeded(client):
    assert client.post("/sim/reset").status_code == 200
    return client


def login(client) -> dict:
    tok = client.post("/auth/demo").json()["token"]
    return {"Authorization": f"Bearer {tok}"}
