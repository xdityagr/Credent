"""Response models. Everything under `Public*` is an allow-list: only these fields
are ever serialized by /public routes."""

from pydantic import BaseModel, Field


class ErrorOut(BaseModel):
    code: str
    message: str


# ---------- requests ----------

class ChallengeIn(BaseModel):
    wallet: str


class VerifyIn(BaseModel):
    wallet: str
    signature: str  # base58 ed25519 signature over the challenge message


class ProfileIn(BaseModel):
    profile: str


class ThresholdIn(BaseModel):
    threshold: int = Field(gt=0)


class AmountIn(BaseModel):
    amount: int = Field(gt=0)


class DepositIn(BaseModel):
    tranche: str
    amount: int = Field(gt=0)


class AdvanceIn(BaseModel):
    days: int = Field(ge=1, le=365)


class PaymentIn(BaseModel):
    borrower: str
    amount: int = Field(gt=0)


class LoanIn(BaseModel):
    loan_id: str


class RecoverIn(BaseModel):
    loan_id: str
    amount: int = Field(gt=0)


# ---------- auth ----------

class SessionOut(BaseModel):
    token: str
    wallet: str
    demo: bool


class MeOut(BaseModel):
    wallet: str
    borrower_id: str | None


# ---------- public ----------

class PublicTranche(BaseModel):
    name: str
    nav: int
    shares: int
    price_e6: int
    coupon_bps: int | None
    coupon_arrears: int
    writedown: int
    loss_position: str


class PublicPool(BaseModel):
    name: str
    day: int
    cash: int
    outstanding: int
    treasury: int
    total_nav: int
    utilization_bps: int
    leverage_x100: int
    subordination_room: int
    senior: PublicTranche
    junior: PublicTranche
    loans_active: int
    loans_late: int
    loans_defaulted: int
    loans_repaid: int
    total_interest: int
    total_losses: int
    total_recovered: int


class PublicNavPoint(BaseModel):
    day: int
    senior_nav: int
    junior_nav: int
    senior_price_e6: int
    junior_price_e6: int
    outstanding: int
    cash: int


class PublicEpoch(BaseModel):
    epoch: int
    due: int
    paid: int
    event: str


class PublicLoan(BaseModel):
    id: str
    borrower: str
    principal: int
    apr_bps: int
    epochs: int
    installment: int
    status: str
    drawn_day: int
    epoch: int
    outstanding: int
    arrears: int
    consecutive_short: int
    proof_id: str | None
    threshold: int | None
    history: list[PublicEpoch]


class PublicEvent(BaseModel):
    seq: int
    day: int
    type: str
    payload: dict
    prev_hash: str
    hash: str
    block: int | None


class PublicLoanDetail(PublicLoan):
    events: list[PublicEvent]


class PublicBlock(BaseModel):
    n: int
    first_seq: int
    last_seq: int
    merkle_root: str
    day: int
    anchor_status: str
    anchor_sig: str | None
    anchor_url: str | None
    memo: str


class ChainVerifyOut(BaseModel):
    ok: bool
    bad_seq: int | None
    events: int
    blocks: int


class PublicAttestation(BaseModel):
    id: str
    source: str
    period_start: int
    period_end: int
    account_hash: str
    commitment: str
    notary_pubkey: str
    signature: str


class PublicProof(BaseModel):
    id: str
    borrower: str
    day: int
    claim: str
    threshold: int
    commitment: str
    attestation: PublicAttestation
    proof_b64: str
    public_inputs_b64: str
    vk_b64: str


class ProofVerifyOut(BaseModel):
    proof_valid: bool
    attestation_valid: bool
    threshold_bound: bool
    commitment_bound: bool
    valid: bool
    verifier: str
    ms: int


class ProverStatus(BaseModel):
    ok: bool
    message: str | None


class AnchorStatus(BaseModel):
    enabled: bool
    cluster: str
    address: str
    balance_lamports: int | None
    last_error: str | None


class PublicStatus(BaseModel):
    day: int
    seeded: bool
    seeding: bool
    seed_error: str | None
    sim_enabled: bool
    prover: ProverStatus
    anchor: AnchorStatus
    notary_pubkey: str
    processor_pubkey: str


class PublicProfile(BaseModel):
    key: str
    label: str
    description: str


# ---------- borrower / lender (authenticated, owner-only) ----------

class ProveOut(BaseModel):
    proof_id: str
    threshold: int
    commitment: str
    timings_ms: dict[str, int]


class CreditLineOut(BaseModel):
    borrower_id: str
    limit: int
    proof_id: str
    opened_day: int


class LoanOut(BaseModel):
    id: str
    principal: int
    installment: int
    apr_bps: int
    epochs: int
    status: str
    drawn_day: int
