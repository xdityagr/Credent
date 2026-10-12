import asyncio
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from credent.api import routes_account, routes_app, routes_public, routes_sim
from credent.chain.client import ChainError
from credent.chain.rehydrate import rehydrate
from credent.config import Settings
from credent.crypto.keys import KeyStore
from credent.db import init_db, make_engine
from credent.errors import DomainError
from credent.events import broadcaster
from credent.models import Pool
from credent.services import clock, sim
from credent.services.context import Ctx
from credent.zk.prover import Prover, get_prover

log = logging.getLogger("credent")
SAFE = {"GET", "HEAD", "OPTIONS"}


def _boot_chain(app: FastAPI) -> None:
    ctx, engine = app.state.ctx, app.state.engine
    with ctx.write_lock, Session(engine, expire_on_commit=False) as s:
        world = clock.world(s)
        s.commit()
        chain = ctx.chain(world)
        try:
            if chain.cluster == "local" and s.exec(select(Pool)).first() is not None:
                n = rehydrate(s, chain)
                log.info("rebuilt in-process chain from the database (%d balances)", n)
            else:
                chain.bootstrap()
        except ChainError as e:
            log.warning("chain bootstrap failed: %s", e)
            app.state.seed_error = f"Solana unavailable: {e}"


def _seed(app: FastAPI) -> None:
    def run():
        app.state.seeding = True
        try:
            sim.reset(app.state.engine, app.state.ctx)
            app.state.seed_error = None
            log.info("demo world seeded")
        except DomainError as e:
            app.state.seed_error = e.message
            log.warning("could not seed demo world: %s", e.message)
        except Exception as e:  # keep the API up; surface it in /public/status
            app.state.seed_error = str(e)
            log.exception("seeding failed")
        finally:
            app.state.seeding = False

    threading.Thread(target=run, name="seed", daemon=True).start()


def create_app(settings: Settings | None = None, prover: Prover | None = None, ctx: Ctx | None = None,
               background: bool | None = None) -> FastAPI:
    settings = settings or (ctx.settings if ctx else Settings())
    engine = make_engine(settings.db_url())
    init_db(engine)
    ctx = ctx or Ctx(settings=settings, keys=KeyStore(settings.keys_dir), prover=prover or get_prover(settings))
    background = settings.background_jobs if background is None else background

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        broadcaster.bind(asyncio.get_running_loop())
        scheduler = None
        _boot_chain(app)
        if background:
            with Session(engine) as s:
                empty = s.exec(select(Pool)).first() is None
            if empty and settings.seed_demo and settings.sim_enabled:
                _seed(app)
            from credent.jobs.scheduler import Scheduler

            scheduler = Scheduler(engine, ctx)
            scheduler.start()
        yield
        if scheduler:
            scheduler.stop()

    app = FastAPI(title="Credent API", version="2.0.0", lifespan=lifespan, description="Private credit, public book.")
    app.state.engine, app.state.ctx = engine, ctx
    app.state.seeding, app.state.seed_error = False, None

    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def csrf_header(request: Request, call_next):
        # Cookie-authenticated mutations must come from our own frontend (custom header forces a CORS preflight).
        if request.method not in SAFE and request.headers.get("x-credent") != "1":
            return JSONResponse({"code": "CSRF", "message": "Missing X-Credent header."}, status_code=403)
        return await call_next(request)

    @app.exception_handler(DomainError)
    async def domain_error(_: Request, e: DomainError):
        return JSONResponse({"code": e.code, "message": e.message}, status_code=e.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, e: RequestValidationError):
        first = e.errors()[0] if e.errors() else {}
        where = ".".join(str(x) for x in first.get("loc", [])[1:])
        return JSONResponse({"code": "INVALID_REQUEST", "message": f"{where}: {first.get('msg', 'invalid')}".strip(": ")},
                            status_code=422)

    for r in (routes_account, routes_app, routes_public, routes_sim):
        app.include_router(r.router)

    uploads = settings.data_dir / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=uploads), name="uploads")

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    return app
