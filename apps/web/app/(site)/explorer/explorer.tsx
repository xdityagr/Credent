"use client";

import { Boxes, CheckCircle2, FileText, Link2, ScrollText, XCircle } from "lucide-react";
import { useState } from "react";
import { LedgerFeed, LedgerSkeleton } from "@/components/data/ledger-feed";
import { LoansTable } from "@/components/data/loans-table";
import { Container, PageHero } from "@/components/site/page-hero";
import {
  Button,
  EmptyState,
  ErrorState,
  Hash,
  NumberSkeleton,
  Panel,
  PanelHeader,
  Segmented,
  Skeleton,
  StatsGlassBar,
  StatusPill,
  TxLink,
} from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { LEDGER_FILTERS } from "@/lib/events";
import { count, usd } from "@/lib/format";
import { useLive } from "@/lib/live";
import { useBlocks, useLedger, useLoans, usePools, useStats, useVerifyChain } from "@/lib/queries";

export function Explorer() {
  const [filter, setFilter] = useState("all");
  const [pool, setPool] = useState<string>("");
  const types = LEDGER_FILTERS.find((f) => f.key === filter)?.types ?? null;
  const ledger = useLedger({ limit: 60, type: types, pool: pool || null });
  const stats = useStats();
  const pools = usePools();
  const loans = useLoans();
  const { connected } = useLive();
  const s = stats.data;
  const v = (n: React.ReactNode) => (s ? n : stats.isPending ? <NumberSkeleton /> : <span className="text-ink-3">—</span>);

  return (
    <>
      <PageHero
        title={
          <>
            The public <span className="italic text-ink-2">book</span>
          </>
        }
        description="Every pool, loan, weekly settlement and loss, hash-chained and anchored to Solana devnet. Borrower financials are not here, and never were."
      >
        <div className="mt-8">
          <ChainCheck />
        </div>
      </PageHero>

      <Container className="space-y-6 pb-24">
        <StatsGlassBar
          items={[
            { label: "Ledger entries", value: v(count(s?.ledger_events)) },
            { label: "Loans active", value: v(count(s?.loans_active)) },
            { label: "Repaid / defaulted", value: v(s ? `${count(s.loans_repaid)} / ${count(s.loans_defaulted)}` : "") },
            { label: "Outstanding", value: v(usd(s?.outstanding, "compact")) },
          ]}
        />

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 md:px-6 md:pt-6">
              <div className="flex items-center gap-3">
                <h2 className="text-[16px] font-medium text-ink">Ledger</h2>
                <StatusPill tone={connected ? "good" : "neutral"} live={connected} icon={!connected}>
                  {connected ? "Live" : "Not streaming"}
                </StatusPill>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(pools.data?.length ?? 0) > 0 && (
                  <select
                    value={pool}
                    onChange={(e) => setPool(e.target.value)}
                    aria-label="Filter by pool"
                    className="h-10 rounded-full border border-line-strong bg-white/[0.03] px-4 text-[13px] text-ink outline-none [&>option]:bg-[#121214]"
                  >
                    <option value="">All pools</option>
                    {pools.data!.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                <Segmented
                  label="Filter ledger"
                  options={LEDGER_FILTERS.map((f) => ({ value: f.key, label: f.label }))}
                  value={filter}
                  onChange={setFilter}
                />
              </div>
            </div>
            <div className="max-h-[720px] overflow-y-auto px-5 pb-3 md:px-6" data-lenis-prevent>
              {ledger.isPending ? (
                <LedgerSkeleton rows={8} />
              ) : ledger.error ? (
                <div className="py-5">
                  <ErrorState error={ledger.error} onRetry={() => ledger.refetch()} />
                </div>
              ) : ledger.data && ledger.data.length > 0 ? (
                <LedgerFeed events={ledger.data} />
              ) : (
                <EmptyState className="my-5" icon={<ScrollText />} title="No entries for this filter" body="Try another filter, or wait for the next settlement." />
              )}
            </div>
          </Panel>
          <Blocks />
        </div>

        <section className="pt-6">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-[20px] font-light tracking-[-0.02em] text-ink">Loan book</h2>
            {loans.data && <span className="text-[13px] text-ink-3">{loans.data.length} loans</span>}
          </div>
          {loans.isPending ? (
            <Skeleton className="h-48 rounded-[20px]" />
          ) : loans.error ? (
            <ErrorState error={loans.error} onRetry={() => loans.refetch()} />
          ) : loans.data && loans.data.length > 0 ? (
            <LoansTable loans={loans.data} />
          ) : (
            <EmptyState icon={<FileText />} title="No loans yet" body="Loans appear here the moment they're drawn." />
          )}
        </section>
      </Container>
    </>
  );
}

function ChainCheck() {
  const m = useVerifyChain();
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="horizon" busy={m.isPending} onClick={() => m.mutate()} icon={<Link2 className="size-4" />} magnetic>
        Verify the entire chain
      </Button>
      {m.data &&
        (m.data.ok ? (
          <p className="inline-flex items-center gap-2 text-[14px] text-junior-text">
            <CheckCircle2 className="size-4" /> All {count(m.data.events)} entries and {count(m.data.blocks)} block roots recomputed. They match.
          </p>
        ) : (
          <p className="inline-flex items-center gap-2 text-[14px] text-loss-text">
            <XCircle className="size-4" /> Chain broken at entry #{m.data.bad_seq}.
          </p>
        ))}
      {m.error && <p className="text-[14px] text-loss-text">{errorMessage(m.error)}</p>}
    </div>
  );
}

function Blocks() {
  const q = useBlocks();
  const blocks = q.data ?? [];
  const anchored = blocks.filter((b) => b.anchor_status === "ANCHORED").length;
  return (
    <Panel className="self-start">
      <PanelHeader
        title="Blocks on Solana"
        description={blocks.length ? `${anchored} of ${blocks.length} blocks anchored to devnet as memos.` : "Each block's Merkle root is written to devnet as a memo."}
      />
      <div className="max-h-[720px] overflow-y-auto px-5 pb-4 pt-2 md:px-6" data-lenis-prevent>
        {q.isPending ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-[14px]" />
            ))}
          </div>
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} compact />
        ) : blocks.length === 0 ? (
          <EmptyState className="my-2" icon={<Boxes />} title="No blocks sealed yet" body="Ledger entries are sealed into blocks every few minutes." />
        ) : (
          <ol className="divide-y divide-line">
            {blocks.slice(0, 30).map((b) => (
              <li key={b.n} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 text-[13.5px]">
                <span className="text-ink">
                  Block {b.n}
                  <span className="ml-2 text-[12.5px] text-ink-3">
                    #{b.first_seq}–{b.last_seq}, day {b.day}
                  </span>
                </span>
                <span className="justify-self-end">
                  {b.anchor_status === "ANCHORED" ? (
                    <TxLink signature={b.anchor_sig} href={b.anchor_url} label="Anchored" />
                  ) : (
                    <StatusPill tone={b.anchor_status === "UNANCHORED" ? "warn" : "pending"}>
                      {b.anchor_status.charAt(0) + b.anchor_status.slice(1).toLowerCase()}
                    </StatusPill>
                  )}
                </span>
                <span className="col-span-2">
                  <Hash value={b.merkle_root} head={10} tail={6} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}
