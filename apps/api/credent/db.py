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
    """Empty every table. Postgres: one TRUNCATE with a lock timeout, retried if a reader holds a lock."""
    if engine.dialect.name != "postgresql":
        SQLModel.metadata.drop_all(engine)
        SQLModel.metadata.create_all(engine)
        return
    import time

    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError

    names = ", ".join(f'"{t.name}"' for t in SQLModel.metadata.sorted_tables)
    for attempt in range(10):
        try:
            with engine.begin() as conn:
                conn.execute(text("SET LOCAL lock_timeout = '2s'"))
                conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
            return
        except OperationalError:
            if attempt == 9:
                raise
            time.sleep(0.3 * (attempt + 1))


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
