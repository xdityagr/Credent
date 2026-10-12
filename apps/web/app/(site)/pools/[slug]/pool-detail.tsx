"use client";

import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { CapitalStack } from "@/components/data/capital-stack";
import { LedgerFeed, LedgerSkeleton } from "@/components/data/ledger-feed";
import { LoansTable } from "@/components/data/loans-table";
import { NavChart } from "@/components/data/nav-chart";
import { ReservesBadge } from "@/components/data/pool-card";
import { Container } from "@/components/site/page-hero";
import {
  Address,
  ButtonLink,
  ColumnLines,
  EmptyState,
  ErrorState,
  OrgAvatar,
  Panel,
  PanelHeader,
  PoolStatusPill,
  Skeleton,
  StatsGlassBar,
} from "@/components/ui";
import { ApiError } from "@/lib/api";
import { dateTime, pct, usd, weeks } from "@/lib/format";
import { useLedger, usePool } from "@/lib/queries";

export function PoolDetail({ slug }: { slug: string }) {
  const q = usePool(slug);
  const p = q.data;

  if (q.error instanceof ApiError && q.error.status === 404) {
    return (
      <Container className="pb-24 pt-40">
        <EmptyState
          title="This pool doesn't exist"
          body="It may have been renamed, or the link is wrong. Browse all pools instead."
          action={
            <ButtonLink href="/pools" size="sm" variant="white">
              Browse pools
            </ButtonLink>
          }
        />
      </Container>
    );
  }

  return (
    <>
      <section className="relative isolate overflow-hidden pt-[76px]">
        <ColumnLines cols={4} className="mx-auto max-w-[1280px] [mask-image:linear-gradient(180deg,#000,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40%_70%_at_75%_0%,rgb(45_91_255/0.2),transparent_75%)]" />
        <Container className="pb-10 pt-10 md:pt-14">
          <Link href="/pools" className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-2 transition hover:text-ink">
            <ArrowLeft className="size-4" /> All pools
          </Link>
          {p ? (
            <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
              <div className="max-w-[720px]">
                <Link href={`/lenders/${p.manager.slug}`} className="inline-flex items-center gap-2.5 text-[14px] text-ink-2 transition hover:text-ink">
                  <OrgAvatar name={p.manager.name} src={p.manager.logo_url} kind="LENDER" size={28} />
                  Managed by {p.manager.name}
                </Link>
                <h1 className="mt-4 font-serif text-[clamp(40px,5.6vw,76px)] leading-[0.98] tracking-[-0.03em] text-[#f4f1ee]">{p.name}</h1>
                {p.description && <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-ink-2">{p.description}</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  <PoolStatusPill status={p.status} />
                  <ReservesBadge reserves={p.reserves} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/app/pools" variant="ember" magnetic>
                  Apply for credit
                </ButtonLink>
                <ButtonLink href="/app/funds" variant="horizon" magnetic>
                  Invest in this pool
                </ButtonLink>
              </div>
            </div>
          ) : q.isPending ? (
            <div className="mt-8 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-16 w-[min(600px,90%)]" />
              <Skeleton className="h-4 w-[min(480px,80%)]" />
            </div>
          ) : (
            <div className="mt-8">
              <ErrorState error={q.error} onRetry={() => q.refetch()} />
            </div>
          )}
        </Container>
      </section>

      {p && (
        <Container className="space-y-6 pb-24">
          <StatsGlassBar
            items={[
              { label: `Capital of ${usd(p.target_size, "compact")} target`, value: usd(p.total_nav, "compact") },
              { label: "Senior coupon", value: pct(p.senior.coupon_bps) },
              { label: "Borrower APR", value: pct(p.borrower_apr_bps) },
              { label: "Utilization", value: pct(p.utilization_bps, 0) },
            ]}
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
            <Panel>
              <PanelHeader title="Capital stack" description="Senior is paid first; junior absorbs losses first." />
              <div className="p-5 md:p-6">
                <CapitalStack pool={p} />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Share prices" description="Each tranche's price per share, indexed to 1.0000 at launch." />
              <div className="p-5 md:p-6">
                <NavChart points={p.nav_history} />
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            <Panel>
              <PanelHeader title="Terms" description="What a business gets, and what it must prove." />
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-[20px] border-t border-line bg-line sm:grid-cols-3">
                {[
                  ["Advance rate", `${pct(p.advance_bps, 0)} of proven revenue`],
                  ["Term", `${weeks(p.term_epochs)}, weekly installments`],
                  ["Min proven revenue", `${usd(p.min_threshold)} over 90 days`],
                  ["Max loan", p.max_loan ? usd(p.max_loan) : "No cap beyond the advance rate"],
                  ["Cash available", usd(p.cash)],
                  ["Lent out", usd(p.outstanding)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#0b0b0c] p-5">
                    <dt className="text-[12.5px] text-ink-3">{k}</dt>
                    <dd className="num mt-1.5 text-[15px] text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel>
              <PanelHeader title="Reserves on Solana" description="The vault's cUSD balance, compared with the book." />
              <dl className="space-y-4 p-5 text-[14px] md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-3">Vault</dt>
                  <dd>
                    <Address value={p.vault_address} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-3">On-chain balance</dt>
                  <dd className="num text-ink">{usd(p.reserves.onchain)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-3">Book cash</dt>
                  <dd className="num text-ink">{usd(p.cash)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-3">Last checked</dt>
                  <dd className="text-ink-2">{dateTime(p.reserves.checked_at)}</dd>
                </div>
                <div className="pt-1">
                  <ReservesBadge reserves={p.reserves} />
                </div>
              </dl>
            </Panel>
          </div>

          <section>
            <div className="mb-4 mt-6 flex items-end justify-between">
              <h2 className="font-display text-[20px] font-light tracking-[-0.02em] text-ink">Loan book</h2>
              <span className="text-[13px] text-ink-3">{p.loans.length} loans</span>
            </div>
            {p.loans.length > 0 ? (
              <LoansTable loans={p.loans} />
            ) : (
              <EmptyState
                icon={<FileText />}
                title="No loans drawn from this pool yet"
                body="When a business draws, the loan appears here with its proven-revenue claim and weekly repayment record."
                action={
                  <ButtonLink href="/signup" size="sm" variant="ember">
                    Apply for credit
                  </ButtonLink>
                }
              />
            )}
          </section>

          <PoolLedger poolId={p.id} />
        </Container>
      )}
    </>
  );
}

function PoolLedger({ poolId }: { poolId: string }) {
  const q = useLedger({ limit: 12, pool: poolId });
  return (
    <Panel>
      <PanelHeader
        title="Ledger activity"
        description="Entries for this pool, newest first."
        action={
          <ButtonLink href="/explorer" size="sm" variant="ghost">
            Open explorer
          </ButtonLink>
        }
      />
      <div className="px-5 pb-3 md:px-6">
        {q.isPending ? (
          <LedgerSkeleton rows={4} />
        ) : q.data && q.data.length > 0 ? (
          <LedgerFeed events={q.data} />
        ) : (
          <p className="py-8 text-center text-[14px] text-ink-3">{q.error ? "The ledger isn't reachable right now." : "No entries yet."}</p>
        )}
      </div>
    </Panel>
  );
}
