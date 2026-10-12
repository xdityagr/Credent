"""Fan-out of committed public ledger events to SSE subscribers.

`ledger.append` queues public event dicts on `session.info["published"]`; after
the transaction commits they are pushed to every subscriber. Rolled-back
events are dropped, so subscribers only ever see what the ledger holds.
"""

import asyncio

from sqlalchemy import event
from sqlalchemy.orm import Session as OrmSession


class Broadcaster:
    def __init__(self) -> None:
        self._subs: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def publish(self, item: dict) -> None:
        if self._loop is None:
            return
        for q in list(self._subs):
            self._loop.call_soon_threadsafe(q.put_nowait, item)

    async def subscribe(self):
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subs.add(q)
        try:
            while True:
                yield await q.get()
        finally:
            self._subs.discard(q)


broadcaster = Broadcaster()


@event.listens_for(OrmSession, "after_commit")
def _after_commit(session: OrmSession) -> None:
    for item in session.info.pop("published", []):
        broadcaster.publish(item)


@event.listens_for(OrmSession, "after_rollback")
def _after_rollback(session: OrmSession) -> None:
    session.info.pop("published", None)
