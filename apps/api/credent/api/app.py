import asyncio
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session

from credent.anchor import AnchorWorker, SolanaAnchor
from credent.api import routes_auth, routes_borrower, routes_lender, routes_public, routes_sim
from credent.config import Settings
from credent.crypto.keys import KeyStore
from credent.db import init_db, make_engine
from credent.errors import DomainError
from credent.events import broadcaster
from credent.models import PoolRow
from credent.services import sim
from credent.services.context import Ctx
from credent.zk.prover import Prover, get_prover

log = logging.getLogger("credent")


def _seed_in_background(app: FastAPI) -> None:
    def run():
        app.state.seeding = True
        try:
            with app.state.lock:
                sim.reset(app.state.engine, app.state.ctx)
            app.state.seed_error = None
            log.info("demo world seeded")
        except DomainError as e:
            app.state.seed_error = e.message
            log.warning("could not seed demo world: %s", e.message)
        except Exception as e:  # keep the API up; surface the problem in /public/status
            app.state.seed_error = str(e)
            log.exception("seeding failed")
        finally:
            app.state.seeding = False

    threading.Thread(target=run, name="seed", daemon=True).start()


def create_app(settings: Settings | None = None, prover: Prover | None = None,
               anchor: SolanaAnchor | None = None, background: bool = True) -> FastAPI:
    settings = settings or Settings()
    engine = make_engine(settings.db_url())
    init_db(engine)
    keys = KeyStore(settings.data_dir / "keys")
    ctx = Ctx(settings=settings, keys=keys, prover=prover or get_prover(settings))
    anchor = anchor or SolanaAnchor(settings, keys)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        broadcaster.bind(asyncio.get_running_loop())
        worker = None
        if background:
            worker = AnchorWorker(engine, anchor)
            worker.start()
            with Session(engine) as s:
                empty = s.get(PoolRow, 1) is None
            if empty and settings.sim_enabled:
                _seed_in_background(app)
        yield
        if worker:
            worker.stop()

    app = FastAPI(title="Credent API", version="0.1.0", lifespan=lifespan,
                  description="Private credit, public book.")
    app.state.engine, app.state.ctx, app.state.anchor = engine, ctx, anchor
    app.state.lock = threading.RLock()
    app.state.seeding, app.state.seed_error = False, None

    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(DomainError)
    async def domain_error(_: Request, e: DomainError):
        return JSONResponse({"code": e.code, "message": e.message}, status_code=e.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, e: RequestValidationError):
        first = e.errors()[0] if e.errors() else {}
        where = ".".join(str(x) for x in first.get("loc", [])[1:])
        return JSONResponse({"code": "INVALID_REQUEST", "message": f"{where}: {first.get('msg', 'invalid')}"},
                            status_code=422)

    for r in (routes_auth, routes_borrower, routes_lender, routes_public, routes_sim):
        app.include_router(r.router)

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    return app
