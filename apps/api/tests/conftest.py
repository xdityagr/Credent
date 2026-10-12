import pytest
from sqlmodel import Session

from credent.config import Settings
from credent.crypto.keys import KeyStore
from credent.db import init_db, make_engine
from credent.services.context import Ctx
from tests.fakes import FakeProver


@pytest.fixture
def engine():
    e = make_engine("sqlite://")
    init_db(e)
    return e


@pytest.fixture
def session(engine):
    with Session(engine) as s:
        yield s


@pytest.fixture
def ctx(tmp_path):
    settings = Settings(data_dir=tmp_path, anchor_enabled=False, database_url="sqlite://")
    return Ctx(settings=settings, keys=KeyStore(tmp_path / "keys"), prover=FakeProver())
