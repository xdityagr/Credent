"""One background thread running interval jobs: clock, chain outbox, deposits, mail, anchoring, Stripe, reserves."""

import logging
import threading
import time
from collections.abc import Callable

from sqlmodel import Session, select

from credent.anchor import ChainAnchor, anchor_pending
from credent.mail import mailer
from credent.models import ClockState, Pool, RevenueSource
from credent.services import clock, funds, public, revenue, sim, transfers
from credent.services.context import Ctx

log = logging.getLogger("credent.jobs")


class Scheduler:
    def __init__(self, engine, ctx: Ctx):
        self.engine, self.ctx = engine, ctx
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="credent-jobs", daemon=True)
        self._last: dict[str, float] = {}
        self.jobs: list[tuple[str, float, Callable[[Session], None]]] = [
            ("transfers", 2, self.transfers),
            ("deposits", 3, self.deposits),
            ("mail", 3, self.mail),
            ("clock", 1, self.clock_tick),
            ("anchor", 15, self.anchor),
            ("stripe", 60, self.stripe),
            ("reserves", 60, self.reserves),
        ]

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        while not self._stop.wait(1.0):
            now = time.monotonic()
            for name, every, fn in self.jobs:
                if now - self._last.get(name, 0) < every:
                    continue
                self._last[name] = now
                try:
                    with Session(self.engine, expire_on_commit=False) as s:
                        fn(s)
                except Exception:  # keep the loop alive; surface in logs
                    log.exception("job %s failed", name)

    def _chain(self, s: Session):
        return self.ctx.chain(clock.world(s))

    def transfers(self, s: Session) -> None:
        with self.ctx.write_lock:
            transfers.process(s, self._chain(s))

    def deposits(self, s: Session) -> None:
        with self.ctx.write_lock:
            funds.confirm_pending(s, self._chain(s))

    def mail(self, s: Session) -> None:
        mailer.send_pending(s, self.ctx.settings)

    def clock_tick(self, s: Session) -> None:
        st = s.get(ClockState, 1)
        if (st is None or st.mode != "accelerated" or self.ctx.settings.clock_mode != "accelerated"
                or s.exec(select(Pool)).first() is None):
            return
        last = self._last.get("clock_day", 0)
        if time.monotonic() - last >= self.ctx.settings.seconds_per_day:
            if last:  # skip the first tick after boot so the world doesn't jump on restart
                sim.advance(s, self.ctx, 1)
            self._last["clock_day"] = time.monotonic()

    def anchor(self, s: Session) -> None:
        anchor_pending(s, ChainAnchor(self._chain(s), self.ctx.settings.anchor_enabled))

    def stripe(self, s: Session) -> None:
        for src in s.exec(select(RevenueSource).where(RevenueSource.kind == "STRIPE",
                                                      RevenueSource.status == "ACTIVE")).all():
            with self.ctx.write_lock:
                try:
                    revenue.poll_stripe(s, self.ctx, src)
                    s.commit()
                except Exception:  # one bad key must not stop the others
                    s.rollback()
                    log.exception("stripe poll failed for %s", src.id)

    def reserves(self, s: Session) -> None:
        public.reconcile(s, self._chain(s))
