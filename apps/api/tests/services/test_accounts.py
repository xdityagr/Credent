import base58
import pytest
from nacl.signing import SigningKey
from sqlmodel import select

from credent.errors import (
    EmailNotVerified,
    EmailTaken,
    Forbidden,
    InvalidCredentials,
    TokenInvalid,
    Unauthorized,
    WeakPassword,
)
from credent.models import AuthSession, EmailOutbox
from credent.services import accounts, orgs, wallets
from tests.conftest import last_link

PW = "Correct-Horse-9"


def signup(session, settings, email="ada@northwind.io"):
    u = accounts.signup(session, settings, email, PW, "Ada Lovelace")
    session.commit()
    return u


def test_signup_sends_verification_and_blocks_login(session, settings):
    signup(session, settings)
    mail = session.exec(select(EmailOutbox)).one()
    assert mail.to == "ada@northwind.io" and "verify-email?token=" in mail.text
    with pytest.raises(EmailNotVerified):
        accounts.login(session, settings, "ada@northwind.io", PW)


def test_verify_then_login_creates_session(session, settings):
    signup(session, settings)
    accounts.verify_email(session, last_link(session, "/verify-email"))
    user, token = accounts.login(session, settings, "ADA@northwind.io ", PW)
    session.commit()
    assert user.email_verified_at is not None
    assert session.exec(select(AuthSession)).one().user_id == user.id
    assert accounts.me(session, user)["onboarding"]["step"] == "role"


def test_verify_token_single_use(session, settings):
    signup(session, settings)
    tok = last_link(session, "/verify-email")
    accounts.verify_email(session, tok)
    with pytest.raises(TokenInvalid):
        accounts.verify_email(session, tok)


def test_bad_password_and_duplicate_email(session, settings):
    signup(session, settings)
    with pytest.raises(EmailTaken):
        accounts.signup(session, settings, "ada@northwind.io", PW, "Ada")
    with pytest.raises(WeakPassword):
        accounts.signup(session, settings, "b@x.io", "short", "B")
    accounts.verify_email(session, last_link(session, "/verify-email"))
    with pytest.raises(InvalidCredentials):
        accounts.login(session, settings, "ada@northwind.io", "Wrong-Pass-1")
    with pytest.raises(InvalidCredentials):
        accounts.login(session, settings, "nobody@x.io", PW)


def test_password_reset_revokes_sessions(session, settings):
    signup(session, settings)
    accounts.verify_email(session, last_link(session, "/verify-email"))
    accounts.login(session, settings, "ada@northwind.io", PW)
    accounts.forgot_password(session, settings, "ada@northwind.io")
    accounts.reset_password(session, last_link(session, "/reset-password"), "New-Password-77")
    session.commit()
    assert all(s.revoked_at for s in session.exec(select(AuthSession)))
    accounts.login(session, settings, "ada@northwind.io", "New-Password-77")


def test_onboarding_org_then_wallet(session, settings):
    user = signup(session, settings)
    with pytest.raises(Forbidden):
        orgs.create(session, user, "BORROWER", {"name": "Northwind"})
    accounts.verify_email(session, last_link(session, "/verify-email"))
    org = orgs.create(session, user, "borrower", {"name": "Northwind Analytics", "website": "northwind.io",
                                                   "sector": "SaaS", "country": "IN"})
    assert org.slug == "northwind-analytics" and org.pseudonym.startswith("BRW-")
    assert org.website == "https://northwind.io"
    assert accounts.me(session, user)["onboarding"]["step"] == "wallet"

    key = SigningKey.generate()
    addr = base58.b58encode(bytes(key.verify_key)).decode()
    msg = wallets.challenge(session, settings, user, org, addr)
    with pytest.raises(Unauthorized):
        wallets.verify(session, user, org, addr, base58.b58encode(SigningKey.generate().sign(msg.encode()).signature).decode())
    msg = wallets.challenge(session, settings, user, org, addr)
    sig = base58.b58encode(key.sign(msg.encode()).signature).decode()
    w = wallets.verify(session, user, org, addr, sig)
    assert w.is_primary
    me = accounts.me(session, user)
    assert me["onboarding"]["step"] == "done" and me["org"]["kind"] == "BORROWER"


def test_custodial_wallet(session, settings, ctx):
    user = signup(session, settings)
    accounts.verify_email(session, last_link(session, "/verify-email"))
    org = orgs.create(session, user, "LENDER", {"name": "Harbor Credit"})
    w = wallets.create_custodial(session, ctx, "w1", user, org)
    assert w.kind == "CUSTODIAL" and w.is_primary
    assert wallets.signer_label(w) == f"custodial:{org.id}"
