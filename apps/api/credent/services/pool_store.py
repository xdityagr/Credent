import json

from sqlmodel import Session

from credent.core.pool import Pool
from credent.models import PoolRow


def load(s: Session) -> Pool:
    row = s.get(PoolRow, 1)
    return Pool.from_dict(json.loads(row.state_json)) if row else Pool()


def save(s: Session, pool: Pool) -> None:
    pool.check()
    row = s.get(PoolRow, 1) or PoolRow(id=1, state_json="{}")
    row.state_json = json.dumps(pool.to_dict())
    s.add(row)
