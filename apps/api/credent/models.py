"""Persistence (v2).

Tables prefixed `Private` hold data that must never reach a public endpoint.
Money columns are integer cents unless named `*_base` (SPL base units, 6 dp).
"""

import itertools
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.types import Text
from sqlmodel import Field, SQLModel

# Monotonic creation order (sim days don't advance during onboarding, so "latest"
# must never be decided by day alone).
_created = itertools.count(time.time_ns())


def _next_created() -> int:
    return next(_created)


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- clock

class ClockState(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    day: int = 90  # days 0..89 are the revenue history window
    genesis: datetime = Field(default_factory=_now)  # calendar date of day 0 is genesis - 90 days
    mode: str = "accelerated"  # accelerated | manual
    world: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])  # scopes on-chain accounts


# ---------------------------------------------------------------- identity

class User(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    name: str
    avatar_url: str | None = None
    email_verified_at: datetime | None = None
    created_at: datetime = Field(default_factory=_now)
    last_login_at: datetime | None = None
    disabled: bool = False


class Organization(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    kind: str  # BORROWER | LENDER
    name: str
    slug: str = Field(index=True, unique=True)
    pseudonym: str = Field(index=True, unique=True)  # public id: BRW-xxxxxx / LND-xxxxxx
    website: str = ""
    sector: str = ""
    country: str = ""
    description: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    logo_path: str | None = None
    is_demo: bool = False
    created_at: datetime = Field(default_factory=_now)


class Membership(SQLModel, table=True):
    user_id: str = Field(foreign_key="user.id", primary_key=True)
    org_id: str = Field(foreign_key="organization.id", primary_key=True)
    role: str = "OWNER"


class AuthSession(SQLModel, table=True):
    id_hash: str = Field(primary_key=True)  # sha256 of the cookie token
    user_id: str = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=_now)
    expires_at: datetime
    ip: str = ""
    user_agent: str = ""
    revoked_at: datetime | None = None


class AuthToken(SQLModel, table=True):
    hash: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    purpose: str  # VERIFY_EMAIL | RESET_PASSWORD
    expires_at: datetime
    used_at: datetime | None = None


class Wallet(SQLModel, table=True):
    address: str = Field(primary_key=True)
    org_id: str = Field(foreign_key="organization.id", index=True)
    kind: str = "EXTERNAL"  # EXTERNAL | CUSTODIAL
    is_primary: bool = False
    verified_at: datetime = Field(default_factory=_now)


class WalletChallenge(SQLModel, table=True):
    nonce: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    address: str
    message: str = Field(sa_column=Column(Text, nullable=False))
    expires_at: datetime


class EmailOutbox(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    to: str
    subject: str
    html: str = Field(sa_column=Column(Text, nullable=False))
    text: str = Field(sa_column=Column(Text, nullable=False))
    status: str = "PENDING"  # PENDING | SENT | FAILED
    attempts: int = 0
    error: str | None = None
    created_at: datetime = Field(default_factory=_now)
    sent_at: datetime | None = None


class Notification(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    org_id: str = Field(foreign_key="organization.id", index=True)
    kind: str
    title: str
    body: str = ""
    href: str = ""
    created_at: datetime = Field(default_factory=_now)
    read_at: datetime | None = None


class AuditLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    ts: datetime = Field(default_factory=_now)
    actor_user_id: str | None = None
    org_id: str | None = Field(default=None, index=True)
    action: str
    target: str = ""
    ip: str = ""
    meta_json: str = "{}"


# ---------------------------------------------------------------- marketplace

class Pool(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    slug: str = Field(index=True, unique=True)
    manager_org_id: str = Field(foreign_key="organization.id", index=True)
    name: str
    description: str = Field(default="", sa_column=Column(Text, nullable=False, default=""))
    status: str = "DRAFT"  # DRAFT | FUNDING | OPEN | CLOSED
    target_size: int
    senior_coupon_bps: int = 900
    max_leverage_x100: int = 400
    fee_bps: int = 1000
    borrower_apr_bps: int = 1800
    advance_bps: int = 4000
    term_epochs: int = 12
    min_threshold: int = 0
    max_loan: int = 0  # 0 = no cap beyond advance rate
    min_first_loss: int = 0
    auto_approve: bool = False
    auto_approve_max: int = 0
    vault_index: int = Field(default=0, index=True)
    vault_address: str | None = None
    state_json: str = Field(default="{}", sa_column=Column(Text, nullable=False, default="{}"))
    created_at: datetime = Field(default_factory=_now)
    created: int = Field(default_factory=_next_created, index=True)


class Position(SQLModel, table=True):
    org_id: str = Field(foreign_key="organization.id", primary_key=True)
    pool_id: str = Field(foreign_key="pool.id", primary_key=True)
    tranche: str = Field(primary_key=True)
    shares: int = 0
    deposited: int = 0
    withdrawn: int = 0


class Application(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    pool_id: str = Field(foreign_key="pool.id", index=True)
    borrower_org_id: str = Field(foreign_key="organization.id", index=True)
    proof_id: str = Field(foreign_key="proofrow.id")
    requested: int
    status: str = "SUBMITTED"  # SUBMITTED | APPROVED | DECLINED | WITHDRAWN | DRAWN | EXPIRED
    terms_json: str = Field(default="{}", sa_column=Column(Text, nullable=False, default="{}"))
    decision_note: str = ""
    decided_by: str | None = None
    decided_at: datetime | None = None
    auto: bool = False
    accept_nonce: str | None = None
    accept_signature: str | None = None
    created_at: datetime = Field(default_factory=_now)
    created: int = Field(default_factory=_next_created, index=True)


class LoanRow(SQLModel, table=True):
    id: str = Field(primary_key=True)  # LN-0001
    pool_id: str = Field(foreign_key="pool.id", index=True)
    application_id: str = Field(foreign_key="application.id")
    borrower_org_id: str = Field(foreign_key="organization.id", index=True)
    borrower_id: str = Field(index=True)  # public pseudonym
    principal: int
    apr_bps: int
    epochs: int
    installment: int
    state_json: str = Field(sa_column=Column(Text, nullable=False))
    status: str
    drawn_day: int
    drawdown_transfer_id: int | None = None
    created: int = Field(default_factory=_next_created, index=True)


class NavSnapshot(SQLModel, table=True):
    pool_id: str = Field(foreign_key="pool.id", primary_key=True)
    day: int = Field(primary_key=True)
    senior_nav: int
    junior_nav: int
    senior_price_e6: int
    junior_price_e6: int
    outstanding: int
    cash: int


# ---------------------------------------------------------------- revenue (private)

class RevenueSource(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    org_id: str = Field(foreign_key="organization.id", index=True)
    kind: str  # DEMO | STRIPE | RECEIPTS
    label: str
    profile: str | None = None
    seed: int | None = None
    collapse_day: int | None = None
    stripe_key_enc: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    stripe_account_hash: str | None = None
    cursor: int | None = None  # last ingested Stripe charge `created` (unix seconds)
    status: str = "ACTIVE"
    connected_at: datetime = Field(default_factory=_now)
    last_polled_at: datetime | None = None
    created: int = Field(default_factory=_next_created, index=True)


class PrivateSeries(SQLModel, table=True):
    source_id: str = Field(foreign_key="revenuesource.id", primary_key=True)
    org_id: str = Field(foreign_key="organization.id", index=True)
    account_ref: str
    daily_json: str = Field(sa_column=Column(Text, nullable=False))
    salt: str
    total: int
    period_start: int
    period_end: int


class AttestationRow(SQLModel, table=True):
    id: str = Field(primary_key=True)
    org_id: str = Field(foreign_key="organization.id", index=True)
    source_id: str = Field(foreign_key="revenuesource.id", index=True)
    borrower_id: str  # public pseudonym
    source: str
    period_start: int
    period_end: int
    account_hash: str
    commitment: str
    notary_pubkey: str
    signature: str
    day: int
    created: int = Field(default_factory=_next_created, index=True)


class ProofRow(SQLModel, table=True):
    id: str = Field(primary_key=True)
    org_id: str = Field(foreign_key="organization.id", index=True)
    borrower_id: str  # public pseudonym
    source_id: str = Field(foreign_key="revenuesource.id")
    attestation_id: str = Field(foreign_key="attestationrow.id")
    threshold: int
    commitment: str
    proof_b64: str = Field(sa_column=Column(Text, nullable=False))
    public_inputs_b64: str = Field(sa_column=Column(Text, nullable=False))
    vk_b64: str = Field(sa_column=Column(Text, nullable=False))
    verified: bool
    timings_json: str = "{}"
    day: int
    expires_day: int
    created: int = Field(default_factory=_next_created, index=True)


class PrivatePayment(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("external_ref"),)
    id: int | None = Field(default=None, primary_key=True)
    org_id: str = Field(foreign_key="organization.id", index=True)
    source_id: str | None = None
    loan_id: str | None = Field(default=None, index=True)
    external_ref: str
    day: int
    amount: int
    swept: int
    released: int


class OperatingBalance(SQLModel, table=True):
    org_id: str = Field(foreign_key="organization.id", primary_key=True)
    amount: int = 0


# ---------------------------------------------------------------- chain

class ChainConfig(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    mint: str
    decimals: int = 6
    collections_address: str
    treasury_address: str
    fee_payer: str
    created_sig: str | None = None


class DepositIntent(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    org_id: str = Field(foreign_key="organization.id", index=True)
    pool_id: str = Field(foreign_key="pool.id", index=True)
    tranche: str
    amount: int  # cents
    from_wallet: str
    message_hash: str
    tx_b64: str = Field(sa_column=Column(Text, nullable=False))
    last_valid_height: int
    status: str = "PREPARED"  # PREPARED | SUBMITTED | CONFIRMED | FAILED | EXPIRED
    signature: str | None = Field(default=None, unique=True)
    error: str | None = None
    created_at: datetime = Field(default_factory=_now)


class ChainTransfer(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    kind: str  # DRAWDOWN | SETTLEMENT | WITHDRAWAL | OPERATING_PAYOUT | INFLOW_MINT | FAUCET | GENESIS
    legs_json: str = Field(sa_column=Column(Text, nullable=False))
    status: str = "PENDING"  # PENDING | SENT | CONFIRMED | FAILED
    signature: str | None = Field(default=None, unique=True)
    attempts: int = 0
    last_error: str | None = None
    ref_type: str = ""
    ref_id: str = ""
    org_id: str | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=_now)
    confirmed_at: datetime | None = None


class ReserveSnapshot(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    pool_id: str = Field(foreign_key="pool.id", index=True)
    ts: datetime = Field(default_factory=_now)
    onchain: int | None  # cents
    book_cash: int
    pending: int
    ok: bool | None


# ---------------------------------------------------------------- public ledger

class LedgerEvent(SQLModel, table=True):
    seq: int = Field(primary_key=True)
    day: int
    type: str = Field(index=True)
    pool_id: str | None = Field(default=None, index=True)
    payload_json: str = Field(sa_column=Column(Text, nullable=False))
    prev_hash: str
    hash: str
    block: int | None = Field(default=None, index=True)


class Block(SQLModel, table=True):
    n: int = Field(primary_key=True)
    first_seq: int
    last_seq: int
    merkle_root: str
    day: int
    anchor_status: str = "PENDING"  # PENDING | ANCHORED | UNANCHORED | DISABLED
    anchor_sig: str | None = None
    anchor_error: str | None = None
