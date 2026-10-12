"""In-app notifications (plus optional email to the organisation's owners)."""

from sqlmodel import Session

from credent.mail import mailer
from credent.models import Notification


def notify(s: Session, org_id: str, kind: str, title: str, body: str = "", href: str = "",
           email: bool = False, settings=None) -> None:
    s.add(Notification(org_id=org_id, kind=kind, title=title, body=body, href=href))
    s.info.setdefault("published", []).append({"type": "Notification", "org_id": org_id, "kind": kind})
    if email and settings is not None:
        from credent.services.orgs import owners

        for u in owners(s, org_id):
            cta = (("Open Credent", f"{settings.app_url}{href}") if href else None)
            mailer.enqueue(s, u.email, title, title, body, cta)
