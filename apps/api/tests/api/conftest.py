import pytest
from fastapi.testclient import TestClient

from credent.api.app import create_app


@pytest.fixture
def app(settings, ctx, tmp_path):
    settings.database_url = f"sqlite:///{(tmp_path / 'api.db').as_posix()}"
    return create_app(settings=settings, ctx=ctx, background=False)


class Client(TestClient):
    """TestClient that always sends the CSRF header, like our frontend does."""

    def request(self, method, url, **kw):
        headers = kw.pop("headers", None) or {}
        headers.setdefault("X-Credent", "1")
        return super().request(method, url, headers=headers, **kw)


@pytest.fixture
def client(app):
    with Client(app) as c:
        yield c


@pytest.fixture
def db(app):
    from sqlmodel import Session

    with Session(app.state.engine, expire_on_commit=False) as s:
        yield s
