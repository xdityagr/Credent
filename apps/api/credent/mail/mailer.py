"""Transactional email: queued in EmailOutbox inside the caller's transaction, sent by a job.

Local development delivers to Mailpit (SMTP :1025, inbox at http://localhost:8025);
set SMTP_* in .env for real delivery (Gmail app password, Resend, ...).

Emails follow the site: a pure-black canvas, a raised card with an ember
(borrower / private) or horizon (lender / public) glow, a serif headline, a
white pill button and a monospace fact table. Built from tables with inline
styles so Gmail, Apple Mail and Outlook render it; the logo is drawn in CSS
because mail clients block or break images (SVG, data URIs, often CID).
"""

import html as _html
import smtplib
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from sqlmodel import Session, col, select

from credent.auth.security import now
from credent.config import Settings
from credent.models import EmailOutbox

# Seeded demo users and reserved test domains never get real mail.
SKIP_DOMAINS = ("demo.credent.dev", ".example", ".invalid")

TONES = {
    "ember": ("#ff8a3d", "#e2452b", "rgba(226,69,43,0.22)"),
    "horizon": ("#8fb4ff", "#2d5bff", "rgba(45,91,255,0.22)"),
    "loss": ("#ff8a80", "#ff5a4e", "rgba(255,90,78,0.20)"),
    "mint": ("#8ff0c8", "#4fe0a6", "rgba(79,224,166,0.18)"),
}
SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif"
SANS = "'Outfit','Helvetica Neue',Helvetica,Arial,sans-serif"
MONO = "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

e = _html.escape

# The Credent mark in pure HTML/CSS: an ember ring around a horizon ring, both open
# on the right. No image, so nothing for a mail client to block or break.
MARK = ('<div style="width:22px;height:22px;border:3px solid #ff7a35;border-right-color:#000000;'
        'border-radius:50%;padding:0">'
        '<div style="width:8px;height:8px;margin:4px 0 0 4px;border:3px solid #5b84ff;'
        'border-right-color:#000000;border-radius:50%"></div></div>')


def _button(label: str, href: str) -> str:
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 6px">
<tr><td bgcolor="#ffffff" style="border-radius:999px;box-shadow:0 0 40px -8px rgba(255,255,255,0.55)">
<a href="{e(href)}" style="display:inline-block;padding:14px 28px;font-family:{SANS};font-size:15px;font-weight:600;color:#000000;text-decoration:none;border-radius:999px">{e(label)}&nbsp;&nbsp;&rarr;</a>
</td></tr></table>
<p style="margin:14px 0 0;font-family:{SANS};font-size:12.5px;line-height:1.6;color:#5e5e63">Button not working? Paste this link into your browser:<br>
<a href="{e(href)}" style="color:#9a9aa0;word-break:break-all">{e(href)}</a></p>"""


def _facts(rows: list[tuple[str, str]]) -> str:
    cells = "".join(
        f"""<tr><td style="padding:12px 0;border-top:1px solid #1f1f23;font-family:{SANS};font-size:13.5px;color:#9a9a9f">{e(k)}</td>
<td align="right" style="padding:12px 0;border-top:1px solid #1f1f23;font-family:{MONO};font-size:13px;color:#ededed">{e(v)}</td></tr>"""
        for k, v in rows)
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;border-bottom:1px solid #1f1f23">{cells}</table>"""


def _steps(items: list[tuple[str, str]], c1: str) -> str:
    rows = "".join(
        f"""<tr><td valign="top" width="34" style="padding:10px 0">
<div style="width:24px;height:24px;line-height:24px;border-radius:999px;border:1px solid #2a2a2f;text-align:center;font-family:{MONO};font-size:11.5px;color:{c1}">{i}</div></td>
<td style="padding:10px 0"><div style="font-family:{SANS};font-size:14.5px;color:#ededed">{e(t)}</div>
<div style="font-family:{SANS};font-size:13px;line-height:1.55;color:#8a8a8f;margin-top:2px">{e(d)}</div></td></tr>"""
        for i, (t, d) in enumerate(items, 1))
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0">{rows}</table>"""


def render(settings: Settings, *, preheader: str, eyebrow: str, title: str, intro: str, tone: str = "ember",
           cta: tuple[str, str] | None = None, facts: list[tuple[str, str]] | None = None,
           steps: list[tuple[str, str]] | None = None, note: str = "") -> str:
    c1, c2, glow = TONES.get(tone, TONES["ember"])
    paragraphs = "".join(
        f'<p style="margin:0 0 14px;font-family:{SANS};font-size:15.5px;line-height:1.65;color:#c9c9cc">{e(p)}</p>'
        for p in intro.split("\n\n") if p.strip())
    body = paragraphs
    if facts:
        body += _facts(facts)
    if steps:
        body += _steps(steps, c1)
    if cta:
        body += _button(*cta)
    if note:
        body += f'<p style="margin:26px 0 0;font-family:{SANS};font-size:13px;line-height:1.6;color:#6e6e74">{e(note)}</p>'
    app = settings.app_url.rstrip("/")
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>{e(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Outfit:wght@400;500;600&family=Geist+Mono&display=swap" rel="stylesheet">
<style>body{{margin:0;padding:0;background:#000000}} a{{color:#ededed}} @media (max-width:600px){{.px{{padding-left:22px!important;padding-right:22px!important}} .h1{{font-size:32px!important}}}}</style>
</head>
<body bgcolor="#000000" style="margin:0;padding:0;background:#000000">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#000000">{e(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000">
<tr><td align="center" style="padding:40px 12px 48px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">

<tr><td class="px" style="padding:0 8px 26px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle">{MARK}</td>
<td valign="middle" style="padding-left:10px;font-family:{SANS};font-size:18px;font-weight:500;letter-spacing:-0.02em;color:#ededed">Credent</td>
</tr></table></td></tr>

<tr><td bgcolor="#0b0b0c" style="background:#0b0b0c;background-image:radial-gradient(120% 70% at 85% 0%,{glow},rgba(11,11,12,0) 60%);border:1px solid #1d1d21;border-radius:28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 56px"><div style="height:1px;line-height:1px;font-size:0;background:{c2};background-image:linear-gradient(90deg,rgba(0,0,0,0),{c1},{c2},rgba(0,0,0,0))">&nbsp;</div></td></tr>
<tr><td class="px" style="padding:40px 40px 42px">
<div style="font-family:{MONO};font-size:11.5px;letter-spacing:0.14em;text-transform:uppercase;color:{c1}">{e(eyebrow)}</div>
<h1 class="h1" style="margin:14px 0 18px;font-family:{SERIF};font-weight:400;font-size:38px;line-height:1.08;letter-spacing:-0.01em;color:#ffffff">{e(title)}</h1>
{body}
</td></tr></table>
</td></tr>

<tr><td class="px" style="padding:28px 8px 0">
<p style="margin:0;font-family:{SERIF};font-size:19px;color:#ededed">Private credit, <span style="font-style:italic;color:{c1}">public book.</span></p>
<p style="margin:10px 0 0;font-family:{SANS};font-size:12.5px;line-height:1.7;color:#5e5e63">
Revenue proven with zero-knowledge proofs, repaid from a lockbox, recorded on Solana.<br>
<a href="{e(app)}/explorer" style="color:#9a9a9f;text-decoration:underline">Public ledger</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="{e(app)}/docs" style="color:#9a9a9f;text-decoration:underline">How it works</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="{e(app)}/app/settings" style="color:#9a9a9f;text-decoration:underline">Account settings</a></p>
<p style="margin:12px 0 0;font-family:{SANS};font-size:11.5px;line-height:1.6;color:#46464b">You're receiving this because of activity on your Credent account. Reply to this email to reach the team.</p>
</td></tr>

</table></td></tr></table>
</body></html>"""


def _text(title: str, intro: str, facts=None, steps=None, cta=None, note: str = "") -> str:
    out = [title, "", intro]
    for k, v in facts or []:
        out.append(f"{k}: {v}")
    for i, (t, d) in enumerate(steps or [], 1):
        out.append(f"{i}. {t}: {d}")
    if cta:
        out += ["", f"{cta[0]}: {cta[1]}"]
    if note:
        out += ["", note]
    out += ["", "Credent: private credit, public book."]
    return "\n".join(out) + "\n"


def deliverable(to: str) -> bool:
    return not to.lower().endswith(SKIP_DOMAINS)


def send(s: Session, settings: Settings, to: str, subject: str, *, title: str, intro: str, **kw) -> None:
    """Queue a branded email. kw: preheader, eyebrow, tone, cta, facts, steps, note."""
    if not deliverable(to):
        return
    kw.setdefault("preheader", intro.split("\n\n")[0][:140])
    kw.setdefault("eyebrow", "Credent")
    s.add(EmailOutbox(to=to, subject=subject, html=render(settings, title=title, intro=intro, **kw),
                      text=_text(title, intro, kw.get("facts"), kw.get("steps"), kw.get("cta"), kw.get("note", ""))))


def _first(name: str) -> str:
    return (name or "there").strip().split(" ")[0]


# ---------------------------------------------------------------- templates

def verify_email(s: Session, settings: Settings, to: str, name: str, token: str) -> None:
    send(s, settings, to, "Confirm your email for Credent",
         eyebrow="Confirm your email", title=f"Welcome to Credent, {_first(name)}.",
         preheader="One click to confirm your email and finish setting up.",
         intro="Confirm your email address to finish creating your account. "
               "Next you'll set up your company and link a Solana wallet. It takes about two minutes.",
         cta=("Confirm email", f"{settings.app_url}/verify-email?token={token}"),
         note="This link expires in 24 hours. If you didn't sign up for Credent, you can ignore this email.")


def welcome(s: Session, settings: Settings, to: str, name: str, org_name: str, kind: str, pseudonym: str) -> None:
    lender = kind == "LENDER"
    steps = ([("Create a pool", "Set your terms: target size, borrower APR, advance rate and the first-loss you hold."),
              ("Fund the first-loss tranche", "Deposit cUSD from your wallet. Senior lenders can co-invest above you."),
              ("Review applications", "Each one carries a zero-knowledge revenue proof. Approve, and the loan draws on-chain.")]
             if lender else
             [("Connect a revenue source", "Stripe, signed payment receipts, or a demo business."),
              ("Prove your revenue", "A zero-knowledge proof shows you clear a threshold without revealing your numbers."),
              ("Apply to a pool", "Your proof is attached. Once approved, sign the terms and the cUSD arrives in your wallet.")])
    send(s, settings, to, f"{org_name} is set up on Credent",
         tone="horizon" if lender else "ember", eyebrow="You're in",
         title=f"{org_name} is ready.",
         preheader="Your company is set up and your wallet is linked. Here's what to do next.",
         intro=f"Thanks, {_first(name)}. Your company and wallet are set up. On the public ledger you appear only as "
               f"{pseudonym}; your company details are shared with a pool manager only when you "
               f"{'manage their pool' if lender else 'apply to their pool'}.",
         facts=[("Company", org_name), ("Role", "Lender" if lender else "Borrower"), ("Public pseudonym", pseudonym)],
         steps=steps, cta=("Open your dashboard", f"{settings.app_url}/app"))


def reset_password(s: Session, settings: Settings, to: str, token: str) -> None:
    send(s, settings, to, "Reset your Credent password",
         tone="horizon", eyebrow="Password reset", title="Choose a new password.",
         preheader="A link to reset your password. It expires in an hour.",
         intro="Someone, hopefully you, asked to reset the password on this account. "
               "Resetting signs you out everywhere else.",
         cta=("Choose a new password", f"{settings.app_url}/reset-password?token={token}"),
         note="This link expires in 1 hour. If it wasn't you, ignore this email; your password stays the same.")


def password_changed(s: Session, settings: Settings, to: str, name: str) -> None:
    send(s, settings, to, "Your Credent password was changed",
         tone="horizon", eyebrow="Security", title="Your password was changed.",
         preheader="Your password was just changed and other sessions were signed out.",
         intro=f"Hi {_first(name)}, the password on your Credent account was just changed, "
               "and any other signed-in sessions were signed out.",
         facts=[("When", now().strftime("%d %b %Y, %H:%M UTC"))],
         cta=("Review your sessions", f"{settings.app_url}/app/settings/security"),
         note="Wasn't you? Reset your password right away from the sign-in page and reply to this email.")


NOTIFY = {  # kind -> (tone, eyebrow)
    "application": ("horizon", "New application"),
    "application_approved": ("mint", "Application approved"),
    "application_declined": ("ember", "Application decision"),
    "loan_drawn": ("ember", "Drawdown"),
    "loan_late": ("loss", "Installment short"),
    "loan_repaid": ("mint", "Loan repaid"),
    "loan_defaulted": ("loss", "Default"),
    "deposit": ("horizon", "New deposit"),
}


def notification(s: Session, settings: Settings, to: str, kind: str, title: str, body: str, href: str) -> None:
    tone, eyebrow = NOTIFY.get(kind, ("ember", "Update"))
    send(s, settings, to, title, tone=tone, eyebrow=eyebrow, title=title,
         intro=body or "There's an update on your Credent account.",
         cta=("Open in Credent", f"{settings.app_url}{href}") if href else ("Open Credent", f"{settings.app_url}/app"))


# ---------------------------------------------------------------- delivery

def _message(settings: Settings, r: EmailOutbox) -> EmailMessage:
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.mail_from, r.to, r.subject
    msg["Date"] = formatdate(localtime=False)
    domain = settings.mail_from.rsplit("@", 1)[-1].strip("> ") or "credent.local"
    msg["Message-ID"] = make_msgid(domain=domain)
    msg.set_content(r.text)
    msg.add_alternative(r.html, subtype="html")
    return msg


def send_pending(s: Session, settings: Settings, limit: int = 20) -> int:
    rows = s.exec(select(EmailOutbox).where(EmailOutbox.status == "PENDING")
                  .order_by(col(EmailOutbox.id)).limit(limit)).all()
    if not rows:
        return 0
    sent = 0
    try:
        smtp = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
    except OSError as err:
        for r in rows:
            r.attempts += 1
            r.error = f"SMTP unreachable: {err}"
            r.status = "FAILED" if r.attempts >= 10 else "PENDING"
            s.add(r)
        s.commit()
        return 0
    with smtp:
        try:
            if settings.smtp_tls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
        except smtplib.SMTPException as err:  # bad app password etc.: keep the queue, record why
            for r in rows:
                r.attempts += 1
                r.error = f"SMTP login failed: {err}"[:300]
                r.status = "FAILED" if r.attempts >= 10 else "PENDING"
                s.add(r)
            s.commit()
            return 0
        for r in rows:
            try:
                smtp.send_message(_message(settings, r))
                r.status, r.sent_at = "SENT", now()
                sent += 1
            except smtplib.SMTPException as err:
                r.attempts += 1
                r.error = str(err)[:300]
                r.status = "FAILED" if r.attempts >= 10 else "PENDING"
            s.add(r)
    s.commit()
    return sent
