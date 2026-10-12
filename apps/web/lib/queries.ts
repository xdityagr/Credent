"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { ApiError, del, get, patch, post } from "./api";
import type {
  ChainBalance,
  ChainConfig,
  ChainVerify,
  Me,
  Notification,
  PublicBlock,
  PublicEvent,
  PublicLoan,
  PublicLoanDetail,
  PublicOrgProfile,
  PublicPool,
  PublicPoolDetail,
  PublicProof,
  PublicStats,
  SessionInfo,
  Wallet,
} from "./types";

/** Query keys. Everything under "public" is invalidated by the live ledger stream. */
export const qk = {
  me: ["me"] as const,
  sessions: ["me", "sessions"] as const,
  notifications: ["notifications"] as const,
  chainConfig: ["chain", "config"] as const,
  balance: ["chain", "balance"] as const,
  stats: ["public", "stats"] as const,
  pools: ["public", "pools"] as const,
  pool: (slug: string) => ["public", "pools", slug] as const,
  loans: ["public", "loans"] as const,
  loan: (id: string) => ["public", "loans", id] as const,
  ledger: (q: string) => ["public", "ledger", q] as const,
  blocks: ["public", "blocks"] as const,
  proof: (id: string) => ["public", "proofs", id] as const,
  org: (slug: string) => ["orgs", slug] as const,
};

type Opts<T> = Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">;

// ---------------- session ----------------

/** null = logged out (401). Throws only for real failures. */
export function useMe(opts: Opts<Me | null> = {}) {
  return useQuery<Me | null, Error>({
    queryKey: qk.me,
    queryFn: async ({ signal }) => {
      try {
        return await get<Me>("/me", signal);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 30_000,
    ...opts,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<{ ok: true }>("/auth/logout"),
    onSettled: () => {
      qc.setQueryData(qk.me, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "public" && q.queryKey[0] !== "me" });
    },
  });
}

export function useSessions() {
  return useQuery({ queryKey: qk.sessions, queryFn: ({ signal }) => get<SessionInfo[]>("/me/sessions", signal) });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: ({ signal }) => get<Notification[]>("/notifications", signal),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => post("/notifications/read", { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}

// ---------------- chain ----------------

export function useChainConfig() {
  return useQuery({
    queryKey: qk.chainConfig,
    queryFn: ({ signal }) => get<ChainConfig>("/chain/config", signal),
    staleTime: 5 * 60_000,
  });
}

export function useBalance(enabled = true) {
  return useQuery({
    queryKey: qk.balance,
    queryFn: ({ signal }) => get<ChainBalance>("/chain/balance", signal),
    enabled,
    refetchInterval: 30_000,
  });
}

// ---------------- wallets ----------------

export function useWalletMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: qk.me });
  return {
    challenge: useMutation({ mutationFn: (address: string) => post<{ message: string }>("/wallets/challenge", { address }) }),
    verify: useMutation({
      mutationFn: (v: { address: string; signature: string }) => post<Wallet>("/wallets/verify", v),
      onSuccess: refresh,
    }),
    custodial: useMutation({ mutationFn: () => post<Wallet>("/wallets/custodial"), onSuccess: refresh }),
    makePrimary: useMutation({
      mutationFn: (address: string) => patch<Wallet>(`/wallets/${address}`, { is_primary: true }),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (address: string) => del(`/wallets/${address}`), onSuccess: refresh }),
  };
}

// ---------------- public ----------------

export function useStats() {
  return useQuery({ queryKey: qk.stats, queryFn: ({ signal }) => get<PublicStats>("/public/stats", signal) });
}

export function usePools() {
  return useQuery({ queryKey: qk.pools, queryFn: ({ signal }) => get<PublicPool[]>("/public/pools", signal) });
}

export function usePool(slug: string) {
  return useQuery({
    queryKey: qk.pool(slug),
    queryFn: ({ signal }) => get<PublicPoolDetail>(`/public/pools/${slug}`, signal),
  });
}

export function useLoans() {
  return useQuery({ queryKey: qk.loans, queryFn: ({ signal }) => get<PublicLoan[]>("/public/loans", signal) });
}

export function useLoan(id: string) {
  return useQuery({ queryKey: qk.loan(id), queryFn: ({ signal }) => get<PublicLoanDetail>(`/public/loans/${id}`, signal) });
}

export function useLedger(params: { limit?: number; type?: string | null; pool?: string | null } = {}) {
  const q = new URLSearchParams();
  q.set("limit", String(params.limit ?? 50));
  if (params.type) q.set("type", params.type);
  if (params.pool) q.set("pool", params.pool);
  const qs = q.toString();
  return useQuery({ queryKey: qk.ledger(qs), queryFn: ({ signal }) => get<PublicEvent[]>(`/public/ledger?${qs}`, signal) });
}

export function useBlocks() {
  return useQuery({ queryKey: qk.blocks, queryFn: ({ signal }) => get<PublicBlock[]>("/public/blocks", signal) });
}

export function useVerifyChain() {
  return useMutation({ mutationFn: () => get<ChainVerify>("/public/ledger/verify") });
}

export function useProof(id: string) {
  return useQuery({ queryKey: qk.proof(id), queryFn: ({ signal }) => get<PublicProof>(`/public/proofs/${id}`, signal) });
}

export function useOrgProfile(slug: string) {
  return useQuery({ queryKey: qk.org(slug), queryFn: ({ signal }) => get<PublicOrgProfile>(`/orgs/${slug}`, signal) });
}
