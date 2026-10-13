"""In-app notifications (plus optional email to the organisation's owners)."""

from sqlmodel import Session

from credent.mail import mailer
from credent.models import Notification


def notify(s: Session, org_id: str, kind: str, title: str, body: str = "", href: str = "",
           email: bool = False, settings=None) -> None:
    s.add(Notification(org_id=org_id, kind=kind, title=title, body=body, href=href))
    s.info.setdefault("published", []).append({"type": "Notification", "org_id": org_id, "kind": kind})
    if email:
        from credent.config import Settings
        from credent.services.orgs import owners

        settings = settings or Settings()
        for u in owners(s, org_id):
            mailer.notification(s, settings, u.email, kind, title, body, href)
