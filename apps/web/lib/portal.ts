"use client";

/** Typed hooks for the authenticated borrower and lender portals. Money is integer cents. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, del, get, patch, post } from "./api";
import { qk } from "./queries";
import type { PublicEpoch, PublicLoan, PublicPool } from "./types";

// ---------------- types ----------------

export interface Series {
  period_start: number;
  period_end: number;
  daily: number[];
  total: number;
  suggested_threshold: number;
}

export interface RevenueSource {
  id: string;
  kind: "DEMO" | "STRIPE" | "RECEIPTS";
  kind_label: string;
  label: string;
  profile: string | null;
  connected_at: string;
  last_polled_at: string | null;
  series: Series | null;
  attestation: { id: string; commitment: string; date: string } | null;
}

export interface ProofView {
  id: string;
  threshold: number;
  commitment: string;
  day: number;
  date: string;
  expires_day: number;
  expires_date: string;
  expired: boolean;
  source: { id: string; kind: string; label: string } | null;
  timings_ms: Record<string, number>;
}

export interface Quote {
  amount: number;
  apr_bps: number;
  epochs: number;
  installment: number;
  total_repaid: number;
  total_interest: number;
}

export interface ApplicationView {
  id: string;
  status: "SUBMITTED" | "APPROVED" | "DECLINED" | "WITHDRAWN" | "DRAWN" | "EXPIRED";
  requested: number;
  terms: Quote;
  decision_note: string;
  auto: boolean;
  created_at: string;
  decided_at: string | null;
  pool: { id: string; slug: string; name: string };
  proof: { id: string; threshold: number; commitment: string; expires_date: string };
  borrower: {
    pseudonym: string;
    name?: string;
    website?: string;
    sector?: string;
    country?: string;
    description?: string;
    logo_url?: string | null;
    track_record?: { loans: number; repaid: number; defaulted: number; active: number };
  };
}

export interface Payment {
  id: number;
  day: number;
  date: string;
  amount: number;
  swept: number;
  released: number;
  loan_id?: string | null;
}

export interface PrivateLoan {
  id: string;
  pool: { id: string; slug: string; name: string };
  principal: number;
  apr_bps: number;
  epochs: number;
  installment: number;
  status: "ACTIVE" | "LATE" | "DEFAULTED" | "REPAID";
  drawn_day: number;
  drawn_date: string;
  outstanding: number;
  arrears: number;
  due_now: number;
  owed_this_week: number;
  swept_this_week: number;
  epoch: number;
  consecutive_short: number;
  schedule: { epoch: number; interest: number; principal: number; total: number }[];
  history: PublicEpoch[];
  payments: Payment[];
  totals: { swept: number; released: number; count: number };
  drawdown: { status: string; signature: string | null; explorer_url: string | null } | null;
}

export interface Operating {
  balance: number;
  available: number;
  settling: number;
}

export interface WalletBalance {
  address: string | null;
  cusd: number;
  sol_lamports: number;
}

export interface BorrowerOverview {
  wallet: WalletBalance;
  operating: Operating;
  active_loan: PrivateLoan | null;
  open_application: ApplicationView | null;
  checklist: { source: boolean; proof: boolean; applied: boolean; loan: boolean };
  best_proof: ProofView | null;
  date: string;
}

export interface Position {
  pool_id: string;
  pool_slug: string;
  pool_name: string;
  tranche: "senior" | "junior";
  shares: number;
  deposited: number;
  withdrawn: number;
  value: number;
  pnl: number;
  price_e6: number;
  coupon_bps: number | null;
}

export interface LenderOverview {
  wallet: WalletBalance;
  pools: PublicPool[];
  pending_applications: number;
  positions: Position[];
  deployed: number;
  pnl: number;
  date: string;
}

export interface ManagedPool extends PublicPool {
  investors: { org: string; pseudonym: string; tranche: string; deposited: number; withdrawn: number; shares: number }[];
  applications: ApplicationView[];
  loans: PublicLoan[];
  nav_history: { day: number; date: string; senior_nav: number; junior_nav: number; senior_price_e6: number; junior_price_e6: number; outstanding: number; cash: number }[];
}

export interface PoolInput {
  name: string;
  description: string;
  target_size: number;
  senior_coupon_bps: number;
  max_leverage_x100: number;
  borrower_apr_bps: number;
  advance_bps: number;
  term_epochs: number;
  min_threshold: number;
  max_loan: number;
  min_first_loss: number;
  auto_approve: boolean;
  auto_approve_max: number;
}

export interface DepositPrep {
  intent_id: string;
  tx_b64: string;
  needs_signature: boolean;
  amount: number;
  tranche: string;
}

export interface DepositStatus {
  id: string;
  status: "PREPARED" | "SUBMITTED" | "CREDITING" | "CONFIRMED" | "FAILED" | "EXPIRED";
  amount: number;
  tranche: string;
  signature: string | null;
  explorer_url: string | null;
  error: string | null;
}

export interface TransferRow {
  id: number | string;
  kind: string;
  status: string;
  signature: string | null;
  amount: number;
  explorer_url: string | null;
  created_at: string;
  error: string | null;
  pool?: string;
  tranche?: string;
}

// ---------------- keys ----------------

export const pk = {
  sources: ["portal", "sources"] as const,
  proofs: ["portal", "proofs"] as const,
  applications: ["portal", "applications"] as const,
  application: (id: string) => ["portal", "applications", id] as const,
  loans: ["portal", "loans"] as const,
  loan: (id: string) => ["portal", "loans", id] as const,
  payments: ["portal", "payments"] as const,
  operating: ["portal", "operating"] as const,
  bOverview: ["portal", "borrower-overview"] as const,
  lOverview: ["portal", "lender-overview"] as const,
  myPools: ["portal", "my-pools"] as const,
  myPool: (id: string) => ["portal", "my-pools", id] as const,
  review: (status: string) => ["portal", "review", status] as const,
  portfolio: ["portal", "portfolio"] as const,
  transfers: ["portal", "transfers"] as const,
};

/** Live data: refresh portal views on a short interval (the accelerated clock moves every couple of minutes). */
const LIVE = { refetchInterval: 15_000 };

export function usePortalInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["portal"] });
    qc.invalidateQueries({ queryKey: qk.balance });
    qc.invalidateQueries({ queryKey: ["public"] });
  };
}

/** A mutation that refreshes every portal view (and balances) when it succeeds. */
function useAct<A, R>(fn: (a: A) => Promise<R>) {
  const refresh = usePortalInvalidate();
  return useMutation({ mutationFn: fn, onSuccess: refresh });
}

// ---------------- borrower ----------------

export const useBorrowerOverview = () =>
  useQuery({ queryKey: pk.bOverview, queryFn: ({ signal }) => get<BorrowerOverview>("/borrower/overview", signal), ...LIVE });
export const useSources = () =>
  useQuery({ queryKey: pk.sources, queryFn: ({ signal }) => get<RevenueSource[]>("/borrower/sources", signal) });
export const useProofs = () =>
  useQuery({ queryKey: pk.proofs, queryFn: ({ signal }) => get<ProofView[]>("/borrower/proofs", signal) });
export const useMyApplications = () =>
  useQuery({ queryKey: pk.applications, queryFn: ({ signal }) => get<ApplicationView[]>("/borrower/applications", signal), ...LIVE });
export const useMyLoans = () =>
  useQuery({ queryKey: pk.loans, queryFn: ({ signal }) => get<PrivateLoan[]>("/borrower/loans", signal), ...LIVE });
export const useMyLoan = (id: string) =>
  useQuery({ queryKey: pk.loan(id), queryFn: ({ signal }) => get<PrivateLoan>(`/borrower/loans/${id}`, signal), ...LIVE });
export const usePayments = () =>
  useQuery({ queryKey: pk.payments, queryFn: ({ signal }) => get<Payment[]>("/borrower/payments", signal), ...LIVE });
export const useOperating = () =>
  useQuery({ queryKey: pk.operating, queryFn: ({ signal }) => get<Operating>("/borrower/operating", signal), ...LIVE });

export function useBorrowerActions() {
  return {
    connectDemo: useAct((profile: string) => post<RevenueSource>("/borrower/sources/demo", { profile })),
    connectStripe: useAct((key: string) => post<RevenueSource>("/borrower/sources/stripe", { key })),
    connectReceipts: useAct((v: { file: File; label: string }) => {
      const form = new FormData();
      form.append("file", v.file);
      form.append("label", v.label);
      return api<RevenueSource>("/borrower/sources/receipts", { method: "POST", form });
    }),
    disconnect: useAct((id: string) => del(`/borrower/sources/${id}`)),
    prove: useAct((v: { source_id: string; threshold: number }) => post<ProofView>("/borrower/proofs", v)),
    apply: useAct((v: { pool_id: string; proof_id: string; amount: number }) => post<ApplicationView>("/borrower/applications", v)),
    withdraw: useAct((id: string) => post<ApplicationView>(`/borrower/applications/${id}/withdraw`)),
    terms: useMutation({ mutationFn: (id: string) => get<{ message: string }>(`/borrower/applications/${id}/terms`) }),
    accept: useAct((v: { id: string; signature: string | null }) =>
      post<PrivateLoan>(`/borrower/applications/${v.id}/accept`, { signature: v.signature })),
    withdrawOperating: useAct((amount: number | null) => post<{ amount: number }>("/borrower/operating/withdraw", { amount })),
  };
}

// ---------------- lender ----------------

export const useLenderOverview = () =>
  useQuery({ queryKey: pk.lOverview, queryFn: ({ signal }) => get<LenderOverview>("/lender/overview", signal), ...LIVE });
export const useMyPools = () =>
  useQuery({ queryKey: pk.myPools, queryFn: ({ signal }) => get<PublicPool[]>("/lender/pools", signal), ...LIVE });
export const useMyPool = (id: string) =>
  useQuery({ queryKey: pk.myPool(id), queryFn: ({ signal }) => get<ManagedPool>(`/lender/pools/${id}`, signal), ...LIVE });
export const useReviewQueue = (status = "") =>
  useQuery({
    queryKey: pk.review(status),
    queryFn: ({ signal }) => get<ApplicationView[]>(`/lender/applications${status ? `?status=${status}` : ""}`, signal),
    ...LIVE,
  });
export const usePortfolio = () =>
  useQuery({
    queryKey: pk.portfolio,
    queryFn: ({ signal }) => get<{ wallet: WalletBalance; positions: Position[]; deployed: number; pnl: number }>("/lender/portfolio", signal),
    ...LIVE,
  });
export const useTransfers = () =>
  useQuery({ queryKey: pk.transfers, queryFn: ({ signal }) => get<TransferRow[]>("/chain/transfers", signal), ...LIVE });

export function useLenderActions() {
  return {
    create: useAct((v: PoolInput) => post<ManagedPool>("/lender/pools", v)),
    update: useAct((v: { id: string; patch: Partial<PoolInput> }) => patch<ManagedPool>(`/lender/pools/${v.id}`, v.patch)),
    fund: useAct((id: string) => post<ManagedPool>(`/lender/pools/${id}/fund`)),
    open: useAct((id: string) => post<ManagedPool>(`/lender/pools/${id}/open`)),
    close: useAct((id: string) => post<ManagedPool>(`/lender/pools/${id}/close`)),
    approve: useAct((v: { id: string; note: string }) => post<ApplicationView>(`/lender/applications/${v.id}/approve`, { note: v.note })),
    decline: useAct((v: { id: string; note: string }) => post<ApplicationView>(`/lender/applications/${v.id}/decline`, { note: v.note })),
    withdraw: useAct((v: { pool_id: string; tranche: string; amount: number | null }) =>
      post<{ amount: number }>(`/lender/pools/${v.pool_id}/withdraw`, { tranche: v.tranche, amount: v.amount })),
  };
}
