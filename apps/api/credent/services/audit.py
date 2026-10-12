"""Private audit trail (never part of the public ledger)."""

import json

from sqlmodel import Session

from credent.models import AuditLog


def log(s: Session, actor_user_id: str | None, org_id: str | None, action: str, target: str = "",
        ip: str = "", **meta) -> None:
    s.add(AuditLog(actor_user_id=actor_user_id, org_id=org_id, action=action, target=target[:200],
                   ip=ip[:64], meta_json=json.dumps(meta, default=str)))
