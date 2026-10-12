"""Transactional email: queued in EmailOutbox inside the caller's transaction, sent by a job.

Local development delivers to Mailpit (SMTP :1025, inbox at http://localhost:8025).
"""

import html as _html
import smtplib
from email.message import EmailMessage

from sqlmodel import Session, col, select

from credent.config import Settings
from credent.models import EmailOutbox
from credent.auth.security import now


def _layout(title: str, body_html: str, cta: tuple[str, str] | None) -> str:
    button = ""
    if cta:
        label, href = cta
        button = (f'<p style="margin:28px 0"><a href="{_html.escape(href)}" style="background:#ffffff;color:#000;'
                  f'padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">'
                  f"{_html.escape(label)}</a></p>"
                  f'<p style="color:#8a8a8f;font-size:13px">Or paste this link: {_html.escape(href)}</p>')
    return f"""<!doctype html><html><body style="margin:0;background:#000;color:#ededed;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:40px 28px">
<div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;margin-bottom:32px">credent</div>
<h1 style="font-size:24px;font-weight:600;margin:0 0 14px">{_html.escape(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#c9c9cc">{body_html}</div>{button}
<p style="color:#5e5e63;font-size:12px;margin-top:40px">Private credit, public book. You're receiving this because of activity on your Credent account.</p>
</div></body></html>"""


def enqueue(s: Session, to: str, subject: str, title: str, body: str, cta: tuple[str, str] | None = None) -> None:
    text = f"{title}\n\n{body}\n" + (f"\n{cta[0]}: {cta[1]}\n" if cta else "")
    s.add(EmailOutbox(to=to, subject=subject, html=_layout(title, _html.escape(body).replace("\n", "<br>"), cta), text=text))


def verify_email(s: Session, settings: Settings, to: str, name: str, token: str) -> None:
    enqueue(s, to, "Confirm your email for Credent", f"Welcome, {name}",
            "Confirm your email address to finish creating your Credent account. The link expires in 24 hours.",
            ("Confirm email", f"{settings.app_url}/verify-email?token={token}"))


def reset_password(s: Session, settings: Settings, to: str, token: str) -> None:
    enqueue(s, to, "Reset your Credent password", "Reset your password",
            "Someone (hopefully you) asked to reset the password on this account. The link expires in 1 hour. "
            "If it wasn't you, you can ignore this email.",
            ("Choose a new password", f"{settings.app_url}/reset-password?token={token}"))


def send_pending(s: Session, settings: Settings, limit: int = 20) -> int:
    rows = s.exec(select(EmailOutbox).where(EmailOutbox.status == "PENDING")
                  .order_by(col(EmailOutbox.id)).limit(limit)).all()
    if not rows:
        return 0
    sent = 0
    try:
        smtp = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
    except OSError as e:
        for r in rows:
            r.attempts += 1
            r.error = f"SMTP unreachable: {e}"
            r.status = "FAILED" if r.attempts >= 10 else "PENDING"
            s.add(r)
        s.commit()
        return 0
    with smtp:
        if settings.smtp_tls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        for r in rows:
            msg = EmailMessage()
            msg["From"], msg["To"], msg["Subject"] = settings.mail_from, r.to, r.subject
            msg.set_content(r.text)
            msg.add_alternative(r.html, subtype="html")
            try:
                smtp.send_message(msg)
                r.status, r.sent_at = "SENT", now()
                sent += 1
            except smtplib.SMTPException as e:
                r.attempts += 1
                r.error = str(e)[:300]
                r.status = "FAILED" if r.attempts >= 10 else "PENDING"
            s.add(r)
    s.commit()
    return sent
