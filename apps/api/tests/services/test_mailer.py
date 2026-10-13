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
