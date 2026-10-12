import { pct, short, usd } from "./format";
import type { PublicEvent } from "./types";

type P = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Tone drives the dot colour beside a ledger row; text always stays in ink tokens. */
export type Tone = "neutral" | "public" | "good" | "loss" | "warn" | "private";

const DESCRIBE: Record<string, (p: P) => [string, Tone]> = {
  PoolCreated: (p) => [`${p.name ?? "Pool"} created: senior coupon ${pct(p.senior_coupon_bps)}, max leverage ${p.max_leverage ?? 4}x`, "public"],
  PoolOpened: (p) => [`${p.name ?? "Pool"} opened for applications`, "public"],
  Deposit: (p) => [`${short(p.wallet ?? p.org ?? "", 4, 4) || "A lender"} deposited ${usd(p.amount)} into ${p.tranche}`, "public"],
  Withdrawal: (p) => [`${usd(p.amount)} withdrawn from ${p.tranche}`, "public"],
  AttestationRecorded: (p) => [`${p.borrower} notarized 90 days of revenue (${sourceName(p.source)})`, "private"],
  ProofVerified: (p) => [`${p.borrower} proved 90-day revenue of at least ${usd(p.threshold)}`, "private"],
  CreditLineOpened: (p) => [`${p.borrower} opened a ${usd(p.limit)} credit line`, "neutral"],
  LoanApproved: (p) => [`${p.loan_id ?? "Loan"} approved for ${usd(p.principal ?? p.amount)}`, "public"],
  LoanDrawn: (p) => [`${p.loan_id} drawn: ${usd(p.principal)} at ${pct(p.apr_bps)} over ${p.epochs} weeks`, "public"],
  TransferConfirmed: (p) => [`${p.kind ? String(p.kind).toLowerCase() : "Transfer"} of ${usd(p.amount)} confirmed on Solana`, "neutral"],
  InstallmentPaid: (p) => [`${p.loan_id} paid week ${Number(p.epoch) + 1} installment of ${usd(p.due)}`, "good"],
  InstallmentShort: (p) => [`${p.loan_id} short ${usd(p.shortfall)} in week ${Number(p.epoch) + 1} (${p.consecutive_short} in a row)`, "warn"],
  CollectionsSettled: (p) => [`Weekly collections settled: ${usd(p.amount ?? p.installments)} to the vault`, "good"],
  LoanLate: (p) => [`${p.loan_id} is late`, "warn"],
  LoanRepaid: (p) => [`${p.loan_id} repaid in full`, "good"],
  LoanDefaulted: (p) => [`${p.loan_id} defaulted with ${usd(p.outstanding)} outstanding`, "loss"],
  LossAllocated: (p) => [`Loss of ${usd(p.loss)}: junior took ${usd(p.junior)}, senior ${usd(p.senior)}`, "loss"],
  RecoveryAllocated: (p) => [`Recovered ${usd(p.amount)} on ${p.loan_id}: senior +${usd(p.senior)}, junior +${usd(p.junior)}`, "good"],
  InterestDistributed: (p) => [
    `Weekly waterfall: ${usd(p.interest)} interest, fee ${usd(p.fee)}, senior ${usd(p.senior)}, junior ${usd(p.junior)}`,
    "public",
  ],
  ReserveAttested: (p) => [`Reserves checked on Solana: ${p.ok === false ? "mismatch" : "match the book"}`, p.ok === false ? "loss" : "good"],
};

export function describe(e: Pick<PublicEvent, "type" | "payload">): [string, Tone] {
  const f = DESCRIBE[e.type];
  if (!f) return [e.type.replace(/([a-z])([A-Z])/g, "$1 $2"), "neutral"];
  try {
    return f(e.payload as P);
  } catch {
    return [e.type, "neutral"];
  }
}

export function sourceName(source: string): string {
  if (source === "receipts") return "signed receipts";
  if (source === "demo") return "demo business";
  return "Stripe via zkTLS";
}

export const toneDot: Record<Tone, string> = {
  neutral: "bg-ink-3",
  public: "bg-senior",
  good: "bg-junior",
  loss: "bg-loss",
  warn: "bg-warn",
  private: "bg-ember-1",
};

export const LEDGER_FILTERS: { key: string; label: string; types: string | null }[] = [
  { key: "all", label: "All", types: null },
  { key: "loans", label: "Loans", types: "LoanApproved,LoanDrawn,InstallmentPaid,InstallmentShort,LoanLate,LoanDefaulted,LoanRepaid" },
  { key: "waterfall", label: "Waterfall", types: "InterestDistributed,LossAllocated,RecoveryAllocated,CollectionsSettled" },
  { key: "proofs", label: "Proofs", types: "AttestationRecorded,ProofVerified" },
  { key: "capital", label: "Capital", types: "Deposit,Withdrawal,PoolCreated,PoolOpened,ReserveAttested" },
];
