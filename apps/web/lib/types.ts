// Mirrors apps/api/credent/api/schemas.py (Public*) and the owner-only views.

export type LoanStatus = "ACTIVE" | "LATE" | "DEFAULTED" | "REPAID";

export interface PublicTranche {
  name: "senior" | "junior";
  nav: number;
  shares: number;
  price_e6: number;
  coupon_bps: number | null;
  coupon_arrears: number;
  writedown: number;
  loss_position: string;
}

export interface PublicPool {
  name: string;
  day: number;
  cash: number;
  outstanding: number;
  treasury: number;
  total_nav: number;
  utilization_bps: number;
  leverage_x100: number;
  subordination_room: number;
  senior: PublicTranche;
  junior: PublicTranche;
  loans_active: number;
  loans_late: number;
  loans_defaulted: number;
  loans_repaid: number;
  total_interest: number;
  total_losses: number;
  total_recovered: number;
}

export interface NavPoint {
  day: number;
  senior_nav: number;
  junior_nav: number;
  senior_price_e6: number;
  junior_price_e6: number;
  outstanding: number;
  cash: number;
}

export interface PublicEpoch {
  epoch: number;
  due: number;
  paid: number;
  event: "InstallmentPaid" | "InstallmentShort";
}

export interface PublicLoan {
  id: string;
  borrower: string;
  principal: number;
  apr_bps: number;
  epochs: number;
  installment: number;
  status: LoanStatus;
  drawn_day: number;
  epoch: number;
  outstanding: number;
  arrears: number;
  consecutive_short: number;
  proof_id: string | null;
  threshold: number | null;
  history: PublicEpoch[];
}

export interface PublicEvent {
  seq: number;
  day: number;
  type: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  block: number | null;
}

export interface PublicLoanDetail extends PublicLoan {
  events: PublicEvent[];
}

export interface PublicBlock {
  n: number;
  first_seq: number;
  last_seq: number;
  merkle_root: string;
  day: number;
  anchor_status: "PENDING" | "ANCHORED" | "UNANCHORED" | "DISABLED";
  anchor_sig: string | null;
  anchor_url: string | null;
  memo: string;
}

export interface ChainVerify {
  ok: boolean;
  bad_seq: number | null;
  events: number;
  blocks: number;
}

export interface PublicAttestation {
  id: string;
  source: string;
  period_start: number;
  period_end: number;
  account_hash: string;
  commitment: string;
  notary_pubkey: string;
  signature: string;
}

export interface PublicProof {
  id: string;
  borrower: string;
  day: number;
  claim: string;
  threshold: number;
  commitment: string;
  attestation: PublicAttestation;
  proof_b64: string;
  public_inputs_b64: string;
  vk_b64: string;
}

export interface ProofVerify {
  proof_valid: boolean;
  attestation_valid: boolean;
  notary_trusted: boolean;
  vk_pinned: boolean;
  threshold_bound: boolean;
  commitment_bound: boolean;
  valid: boolean;
  verifier: string;
  ms: number;
}

export interface PublicStatus {
  day: number;
  seeded: boolean;
  seeding: boolean;
  seed_error: string | null;
  sim_enabled: boolean;
  prover: { ok: boolean; message: string | null };
  anchor: {
    enabled: boolean;
    cluster: string;
    address: string;
    balance_lamports: number | null;
    last_error: string | null;
  };
  notary_pubkey: string;
  processor_pubkey: string;
}

export interface Profile {
  key: string;
  label: string;
  description: string;
}

// ---- owner-only ----

export interface SeriesView {
  source: "stripe-zktls-sim" | "receipts";
  period_start: number;
  period_end: number;
  daily: number[];
  total: number;
  suggested_threshold: number;
}

export interface PrivatePayment {
  id: number;
  borrower_id: string;
  loan_id: string | null;
  day: number;
  amount: number;
  swept: number;
  released: number;
}

export interface LoanStateView {
  schedule: { interest: number; principal: number }[];
  outstanding: number;
  epoch: number;
  swept: number;
  arrears_interest: number;
  arrears_principal: number;
  consecutive_short: number;
  status: LoanStatus;
  history: PublicEpoch[];
}

export interface BorrowerView {
  borrower: {
    id: string;
    wallet: string;
    profile: string;
    business: string;
    description: string;
  } | null;
  series?: SeriesView | null;
  attestation?: (PublicAttestation & { borrower_id: string; day: number }) | null;
  proof?: {
    id: string;
    attestation_id: string;
    threshold: number;
    commitment: string;
    verified: boolean;
    day: number;
    timings_ms: Record<string, number>;
  } | null;
  credit_line?: { borrower_id: string; limit: number; proof_id: string; opened_day: number } | null;
  loan?: {
    id: string;
    principal: number;
    apr_bps: number;
    epochs: number;
    installment: number;
    status: LoanStatus;
    drawn_day: number;
    due_now: number;
    state: LoanStateView;
  } | null;
  payments?: PrivatePayment[];
  totals?: { swept: number; released: number };
}

export interface ProveResult {
  proof_id: string;
  threshold: number;
  commitment: string;
  timings_ms: Record<string, number>;
}

export interface LenderPositions {
  wallet: string;
  balance: number;
  positions: { tranche: "senior" | "junior"; shares: number; deposited: number; value: number; pnl: number }[];
}
