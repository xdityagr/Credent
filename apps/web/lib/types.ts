// Types for the v2 API contract. Money is integer cents everywhere.

// ---------------- identity ----------------

export type OrgKind = "BORROWER" | "LENDER";
export type OnboardingStep = "verify_email" | "role" | "company" | "logo" | "wallet" | "done";

export interface User {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  avatar_url: string | null;
}

export interface Org {
  id: string;
  kind: OrgKind;
  name: string;
  slug: string;
  website: string | null;
  sector: string | null;
  country: string | null;
  description: string | null;
  logo_url: string | null;
  pseudonym: string;
  is_demo: boolean;
}

export interface Wallet {
  address: string;
  kind: "EXTERNAL" | "CUSTODIAL";
  is_primary: boolean;
  verified_at: string | null;
}

export interface Me {
  user: User;
  org: Org | null;
  membership: { role: string } | null;
  wallets: Wallet[];
  onboarding: { step: OnboardingStep };
}

export interface SessionInfo {
  id: string;
  created_at: string;
  ip: string | null;
  user_agent: string | null;
  current: boolean;
}

export interface PublicOrgProfile {
  name: string;
  slug: string;
  kind: OrgKind;
  website: string | null;
  sector: string | null;
  country: string | null;
  description: string | null;
  logo_url: string | null;
  pools: PublicPool[];
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  created_at: string;
  read_at: string | null;
}

// ---------------- chain ----------------

export interface ChainConfig {
  cluster: string;
  mint: string;
  decimals: number;
  fee_payer: string;
  fee_payer_lamports: number;
  enabled: boolean;
}

export interface ChainBalance {
  address: string;
  /** cUSD in cents */
  cusd: number;
  sol_lamports: number;
}

export interface FaucetResult {
  signature: string;
  explorer_url: string;
}

// ---------------- public ----------------

export interface PublicStats {
  pools: number;
  total_nav: number;
  outstanding: number;
  loans_active: number;
  loans_repaid: number;
  loans_defaulted: number;
  proofs_verified: number;
  ledger_events: number;
  date: string;
}

export interface TrancheSummary {
  nav: number;
  price_e6: number;
  coupon_bps?: number;
  writedown: number;
}

export type PoolStatus = "DRAFT" | "FUNDING" | "OPEN" | "CLOSED";

export interface PublicPool {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: PoolStatus;
  manager: { name: string; slug: string; logo_url: string | null };
  target_size: number;
  total_nav: number;
  cash: number;
  outstanding: number;
  utilization_bps: number;
  senior: TrancheSummary & { coupon_bps: number };
  junior: TrancheSummary;
  borrower_apr_bps: number;
  advance_bps: number;
  term_epochs: number;
  min_threshold: number;
  max_loan: number;
  loans_active: number;
  reserves: { ok: boolean | null; onchain: number | null; checked_at: string | null };
  vault_address: string | null;
}

export interface NavPoint {
  day: number;
  date: string;
  senior_nav: number;
  junior_nav: number;
  senior_price_e6: number;
  junior_price_e6: number;
}

export interface PublicPoolDetail extends PublicPool {
  nav_history: NavPoint[];
  loans: PublicLoan[];
}

export type LoanStatus = "ACTIVE" | "LATE" | "DEFAULTED" | "REPAID";

export interface PublicEpoch {
  epoch: number;
  due: number;
  paid: number;
  event: "InstallmentPaid" | "InstallmentShort" | string;
}

export interface PublicLoan {
  id: string;
  pool_id?: string;
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
  pool_id?: string | null;
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
