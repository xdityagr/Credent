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
    genesis = state(s).genesis
    if genesis.tzinfo is None:
        genesis = genesis.replace(tzinfo=timezone.utc)
    return genesis + timedelta(days=day - LAUNCH_DAY)


def iso_date(s: Session, day: int) -> str:
    return date_of(s, day).date().isoformat()
