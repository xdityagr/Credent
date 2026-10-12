"""Persistence. Tables prefixed `Private` hold data that must never reach a public endpoint."""

import itertools
import time

from sqlmodel import Field, SQLModel

# Monotonic creation order. Sim days don't advance during onboarding, so "latest"
# must not be decided by day alone (ties would resolve to the oldest row).
_created = itertools.count(time.time_ns())


def _next_created() -> int:
    return next(_created)


class SimState(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    day: int = 90  # days 0..89 are the revenue history window


class AuthSession(SQLModel, table=True):
    token: str = Field(primary_key=True)
    wallet: str = Field(index=True)
    demo: bool = False


class Challenge(SQLModel, table=True):
    wallet: str = Field(primary_key=True)
    nonce: str


class Borrower(SQLModel, table=True):
    id: str = Field(primary_key=True)  # public pseudonym, e.g. BRW-7F3A
    wallet: str = Field(index=True, unique=True)
    profile: str
    seed: int
    collapse_day: int | None = None


class PrivateSeries(SQLModel, table=True):
    borrower_id: str = Field(primary_key=True, foreign_key="borrower.id")
    source: str
    account_ref: str
    daily_json: str
    salt: str  # decimal string field element
    total: int
    period_start: int
    period_end: int


class AttestationRow(SQLModel, table=True):
    id: str = Field(primary_key=True)
    borrower_id: str = Field(index=True, foreign_key="borrower.id")
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
    borrower_id: str = Field(index=True, foreign_key="borrower.id")
    attestation_id: str = Field(foreign_key="attestationrow.id")
    threshold: int
    commitment: str
    proof_b64: str
    public_inputs_b64: str
    vk_b64: str
    verified: bool
    timings_json: str = "{}"
    day: int
    created: int = Field(default_factory=_next_created, index=True)


class CreditLine(SQLModel, table=True):
    borrower_id: str = Field(primary_key=True, foreign_key="borrower.id")
    limit: int
    proof_id: str = Field(foreign_key="proofrow.id")
    opened_day: int
    drawn: bool = False  # single-use: a new draw needs a fresh proof and line


class LoanRow(SQLModel, table=True):
    id: str = Field(primary_key=True)
    borrower_id: str = Field(index=True, foreign_key="borrower.id")
    principal: int
    apr_bps: int
    epochs: int
    installment: int
    state_json: str
    status: str
    drawn_day: int
    created: int = Field(default_factory=_next_created, index=True)


class PrivatePayment(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    borrower_id: str = Field(index=True, foreign_key="borrower.id")
    loan_id: str | None = None
    day: int
    amount: int
    swept: int
    released: int


class PoolRow(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    state_json: str


class Position(SQLModel, table=True):
    wallet: str = Field(primary_key=True)
    tranche: str = Field(primary_key=True)
    shares: int = 0
    deposited: int = 0


class Balance(SQLModel, table=True):
    wallet: str = Field(primary_key=True)
    amount: int = 0


class LedgerEvent(SQLModel, table=True):
    seq: int = Field(primary_key=True)
    day: int
    type: str = Field(index=True)
    payload_json: str
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


class NavSnapshot(SQLModel, table=True):
    day: int = Field(primary_key=True)
    senior_nav: int
    junior_nav: int
    senior_price_e6: int
    junior_price_e6: int
    outstanding: int
    cash: int
