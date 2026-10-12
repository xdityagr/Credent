from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from credent import models  # noqa: F401  (registers tables)


def make_engine(url: str):
    if url.startswith("sqlite"):
        kwargs = {"connect_args": {"check_same_thread": False}}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
        engine = create_engine(url, **kwargs)

        @event.listens_for(engine, "connect")
        def _pragmas(dbapi_conn, _):
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA busy_timeout=5000")
            cur.close()

        return engine
    return create_engine(url)


def init_db(engine) -> None:
    SQLModel.metadata.create_all(engine)


def reset_db(engine) -> None:
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


__all__ = ["Session", "make_engine", "init_db", "reset_db"]


def migrate(url: str) -> None:
    """Apply Alembic migrations (used for Postgres; SQLite test databases use create_all)."""
    from alembic import command
    from alembic.config import Config

    from credent.config import API_ROOT

    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")
