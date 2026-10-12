import re

import pytest
from sqlmodel import Session, select

from credent.chain.client import LiteChain
from credent.config import Settings
from credent.crypto.keys import KeyStore
from credent.db import init_db, make_engine
from credent.models import EmailOutbox
from credent.services.context import Ctx
from tests.fakes import FakeProver


@pytest.fixture
def engine():
    e = make_engine("sqlite://")
    init_db(e)
    return e


@pytest.fixture
def session(engine):
    with Session(engine, expire_on_commit=False) as s:
        yield s


@pytest.fixture
def settings(tmp_path):
    return Settings(data_dir=tmp_path, keys_dir=tmp_path / "keys", anchor_enabled=False,
                    database_url="sqlite://", chain_mode="local", background_jobs=False,
                    seed_demo=False, clock_mode="manual")


@pytest.fixture
def ctx(settings):
    return Ctx(settings=settings, keys=KeyStore(settings.keys_dir), prover=FakeProver(), client=LiteChain())


def last_link(session, path: str) -> str:
    """The token from the most recent email linking to `path`."""
    for mail in reversed(session.exec(select(EmailOutbox)).all()):
        m = re.search(rf"{re.escape(path)}\?token=([\w\-]+)", mail.text)
        if m:
            return m.group(1)
    raise AssertionError(f"no email linking to {path}")
