from sqlmodel import select

from credent.mail import mailer
from credent.models import EmailOutbox


def test_branded_email_has_inline_logo_and_text_part(session, settings):
    mailer.verify_email(session, settings, "ada@northwind.io", "Ada Lovelace", "tok123")
    row = session.exec(select(EmailOutbox)).one()
    assert "Welcome to Credent, Ada." in row.html and "border-radius:50%" in row.html  # CSS mark, no image
    assert "verify-email?token=tok123" in row.text
    msg = mailer._message(settings, row)
    parts = [p.get_content_type() for p in msg.walk()]
    assert "image/png" not in parts and "text/plain" in parts and "text/html" in parts
    assert msg["Message-ID"]


def test_demo_and_reserved_addresses_are_never_mailed(session, settings):
    mailer.notification(session, settings, "northwind@demo.credent.dev", "loan_drawn", "Funds", "x", "/app")
    mailer.notification(session, settings, "a@foo.example", "loan_drawn", "Funds", "x", "/app")
    assert session.exec(select(EmailOutbox)).all() == []


def test_welcome_is_tailored_to_role(session, settings):
    mailer.welcome(session, settings, "ada@northwind.io", "Ada", "Northwind", "LENDER", "LND-1A2B3C")
    html = session.exec(select(EmailOutbox)).one().html
    assert "Create a pool" in html and "LND-1A2B3C" in html and "Connect a revenue source" not in html


def _brevo(status: int, seen: list):
    import httpx

    def handle(req):
        seen.append(req)
        return httpx.Response(status, json={"messageId": "<m@brevo>"} if status < 300 else {"message": "Key not found"})
    return httpx.Client(transport=httpx.MockTransport(handle))


def test_brevo_sends_over_https_when_configured(session, settings):
    import json

    settings.brevo_api_key, settings.mail_from = "xkeysib-test", "Credent <getcredent@gmail.com>"
    mailer.verify_email(session, settings, "ada@northwind.io", "Ada", "tok")
    session.commit()
    seen = []
    assert mailer.send_pending(session, settings, http=_brevo(201, seen)) == 1
    body = json.loads(seen[0].content)
    assert seen[0].headers["api-key"] == "xkeysib-test"
    assert body["sender"] == {"name": "Credent", "email": "getcredent@gmail.com"}
    assert body["to"] == [{"email": "ada@northwind.io"}] and "verify-email?token=tok" in body["textContent"]
    assert session.exec(select(EmailOutbox)).one().status == "SENT"


def test_brevo_rejection_keeps_the_email_queued(session, settings):
    settings.brevo_api_key = "bad"
    mailer.verify_email(session, settings, "ada@northwind.io", "Ada", "tok")
    session.commit()
    assert mailer.send_pending(session, settings, http=_brevo(401, [])) == 0
    row = session.exec(select(EmailOutbox)).one()
    assert row.status == "PENDING" and "Key not found" in row.error


def test_mail_that_failed_on_blocked_smtp_is_retried_over_https(session, settings):
    mailer.verify_email(session, settings, "ada@northwind.io", "Ada", "tok")
    row = session.exec(select(EmailOutbox)).one()
    row.status, row.attempts, row.error = "FAILED", 10, "SMTP unreachable: [Errno 101] Network is unreachable"
    session.add(row)
    session.commit()
    settings.brevo_api_key = "xkeysib-test"
    assert mailer.send_pending(session, settings, http=_brevo(201, [])) == 1
    assert session.exec(select(EmailOutbox)).one().status == "SENT"
