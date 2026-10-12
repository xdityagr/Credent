import { pct, short, usd } from "./format";
import type { PublicEvent } from "./types";

type P = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Tone = "ink" | "junior" | "loss" | "warn" | "envelope";

const DESCRIBE: Record<string, (p: P) => [string, Tone]> = {
  PoolCreated: (p) => [`${p.name} opened: senior coupon ${pct(p.senior_coupon_bps)}, max leverage ${p.max_leverage}x`, "ink"],
  Deposit: (p) => [`${short(p.wallet, 4, 4)} deposited ${usd(p.amount)} into ${p.tranche}`, "ink"],
  AttestationRecorded: (p) => [`${p.borrower} notarized 90 days of revenue (${sourceName(p.source)})`, "envelope"],
  ProofVerified: (p) => [`${p.borrower} proved 90-day revenue of at least ${usd(p.threshold)}`, "envelope"],
  CreditLineOpened: (p) => [`${p.borrower} opened a ${usd(p.limit)} credit line`, "ink"],
  LoanDrawn: (p) => [`${p.loan_id} drawn: ${usd(p.principal)} at ${pct(p.apr_bps)} over ${p.epochs} weeks`, "ink"],
  InstallmentPaid: (p) => [`${p.loan_id} paid week ${p.epoch + 1} installment of ${usd(p.due)}`, "junior"],
  InstallmentShort: (p) => [`${p.loan_id} short ${usd(p.shortfall)} in week ${p.epoch + 1} (${p.consecutive_short} in a row)`, "warn"],
  LoanLate: (p) => [`${p.loan_id} is late`, "warn"],
  LoanRepaid: (p) => [`${p.loan_id} repaid in full`, "junior"],
  LoanDefaulted: (p) => [`${p.loan_id} defaulted with ${usd(p.outstanding)} outstanding`, "loss"],
  LossAllocated: (p) => [`Loss of ${usd(p.loss)}: junior took ${usd(p.junior)}, senior ${usd(p.senior)}`, "loss"],
  RecoveryAllocated: (p) => [`Recovered ${usd(p.amount)} on ${p.loan_id}: senior +${usd(p.senior)}, junior +${usd(p.junior)}`, "junior"],
  InterestDistributed: (p) => [
    `Weekly waterfall: ${usd(p.interest)} interest, fee ${usd(p.fee)}, senior ${usd(p.senior)}, junior ${usd(p.junior)}`,
    "ink",
  ],
};

export function describe(e: Pick<PublicEvent, "type" | "payload">): [string, Tone] {
  const f = DESCRIBE[e.type];
  return f ? f(e.payload as P) : [e.type, "ink"];
}

export function sourceName(source: string): string {
  return source === "receipts" ? "signed receipts" : "Stripe via zkTLS";
}

export const toneText: Record<Tone, string> = {
  ink: "text-ink",
  junior: "text-junior",
  loss: "text-loss",
  warn: "text-warn",
  envelope: "text-envelope",
};

export const toneDot: Record<Tone, string> = {
  ink: "bg-ink-faint",
  junior: "bg-junior",
  loss: "bg-loss",
  warn: "bg-warn",
  envelope: "bg-envelope",
};
