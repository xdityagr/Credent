from sqlmodel import Session

from credent.models import SimState


def state(s: Session) -> SimState:
    st = s.get(SimState, 1)
    if st is None:
        st = SimState()
        s.add(st)
        s.flush()
    return st


def today(s: Session) -> int:
    return state(s).day
