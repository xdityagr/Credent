"""Protocol clock. Integer days; day 90 is "launch" and maps to the genesis timestamp."""

from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from credent.models import ClockState

LAUNCH_DAY = 90


def state(s: Session) -> ClockState:
    st = s.get(ClockState, 1)
    if st is None:
        st = ClockState()
        s.add(st)
        s.flush()
    return st


def today(s: Session) -> int:
    return state(s).day


def world(s: Session) -> str:
    return state(s).world


def date_of(s: Session, day: int) -> datetime:
    """Midnight UTC that starts protocol `day` (days run midnight to midnight UTC)."""
    g = state(s).genesis
    g0 = datetime(g.year, g.month, g.day, tzinfo=timezone.utc)
    return g0 + timedelta(days=day - LAUNCH_DAY)


def iso_date(s: Session, day: int) -> str:
    return date_of(s, day).date().isoformat()
