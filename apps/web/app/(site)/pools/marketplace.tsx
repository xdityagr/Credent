"use client";

import { Layers, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { PoolCard, PoolCardSkeleton } from "@/components/data/pool-card";
import { Container, PageHero } from "@/components/site/page-hero";
import { Button, ButtonLink, EmptyState, ErrorState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { usePools } from "@/lib/queries";
import type { PublicPool } from "@/lib/types";

type Term = "any" | "short" | "mid" | "long";
type Sort = "nav" | "coupon" | "apr" | "threshold";

const TERM_OPTS: { value: Term; label: string }[] = [
  { value: "any", label: "Any term" },
  { value: "short", label: "≤ 8 wks" },
  { value: "mid", label: "9–16 wks" },
  { value: "long", label: "17+ wks" },
];

const REVENUE_STEPS = [0, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000]; // cents

function termOk(p: PublicPool, t: Term) {
  if (t === "short") return p.term_epochs <= 8;
  if (t === "mid") return p.term_epochs > 8 && p.term_epochs <= 16;
  if (t === "long") return p.term_epochs > 16;
  return true;
}

const selectCls =
  "h-10 appearance-none rounded-full border border-line-strong bg-white/[0.03] pl-4 pr-9 text-[13.5px] text-ink outline-none transition hover:border-white/20 focus:border-horizon-2/70 [&>option]:bg-[#121214]";

function Pick<V extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: string }[];
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        className={selectCls}
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const opt = options.find((o) => String(o.value) === raw);
          if (opt) onChange(opt.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <SlidersHorizontal className="pointer-events-none absolute right-3.5 size-3.5 text-ink-3" aria-hidden />
    </label>
  );
}

export function PoolsMarketplace() {
  const q = usePools();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState<Term>("any");
  const [minCoupon, setMinCoupon] = useState(0); // bps
  const [maxApr, setMaxApr] = useState(10_000); // bps
  const [revenue, setRevenue] = useState(0); // cents; 0 = any
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("nav");

  const pools = useMemo(() => {
    const list = (q.data ?? []).filter(
      (p) =>
        p.status !== "DRAFT" &&
        (!openOnly || p.status === "OPEN") &&
        termOk(p, term) &&
        p.senior.coupon_bps >= minCoupon &&
        p.borrower_apr_bps <= maxApr &&
        (revenue === 0 || p.min_threshold <= revenue) &&
        (query.trim() === "" ||
          `${p.name} ${p.manager.name} ${p.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())),
    );
    const key: Record<Sort, (p: PublicPool) => number> = {
      nav: (p) => -p.total_nav,
      coupon: (p) => -p.senior.coupon_bps,
      apr: (p) => p.borrower_apr_bps,
      threshold: (p) => p.min_threshold,
    };
    return [...list].sort((a, b) => key[sort](a) - key[sort](b));
  }, [q.data, query, term, minCoupon, maxApr, revenue, openOnly, sort]);

  const filtered = query !== "" || term !== "any" || minCoupon > 0 || maxApr < 10_000 || revenue > 0 || openOnly;
  const reset = () => {
    setQuery("");
    setTerm("any");
    setMinCoupon(0);
    setMaxApr(10_000);
    setRevenue(0);
    setOpenOnly(false);
  };

  return (
    <>
      <PageHero
        title={
          <>
            Lending pools, <span className="italic text-ink-2">in the open</span>
          </>
        }
        description="Each pool is run by a lender company with published terms. Lenders choose a tranche; businesses apply with a revenue proof. Every figure below comes from the public ledger."
      />
      <Container className="pb-24">
        {/* filters: one row */}
        <div className="glass sticky top-[84px] z-30 flex flex-wrap items-center gap-2 rounded-[24px] p-2">
          <label className="relative flex min-w-[200px] flex-1 items-center">
            <Search className="pointer-events-none absolute left-3.5 size-4 text-ink-3" aria-hidden />
            <span className="sr-only">Search pools</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pools or managers"
              className="h-10 w-full rounded-full border border-transparent bg-transparent pl-10 pr-4 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-horizon-2/60"
            />
          </label>
          <Pick label="Term" value={term} onChange={setTerm} options={TERM_OPTS} />
          <Pick
            label="Minimum senior coupon"
            value={minCoupon}
            onChange={setMinCoupon}
            options={[
              { value: 0, label: "Any coupon" },
              { value: 600, label: "Coupon ≥ 6%" },
              { value: 800, label: "Coupon ≥ 8%" },
              { value: 1000, label: "Coupon ≥ 10%" },
            ]}
          />
          <Pick
            label="Maximum borrower APR"
            value={maxApr}
            onChange={setMaxApr}
            options={[
              { value: 10_000, label: "Any APR" },
              { value: 1500, label: "APR ≤ 15%" },
              { value: 2000, label: "APR ≤ 20%" },
              { value: 2500, label: "APR ≤ 25%" },
            ]}
          />
          <Pick
            label="My proven 90-day revenue"
            value={revenue}
            onChange={setRevenue}
            options={REVENUE_STEPS.map((c) => ({
              value: c,
              label: c === 0 ? "Any min revenue" : `I can prove $${(c / 100 / 1000).toLocaleString("en-US")}k`,
            }))}
          />
          <button
            type="button"
            aria-pressed={openOnly}
            onClick={() => setOpenOnly((v) => !v)}
            className={cn(
              "h-10 rounded-full border px-4 text-[13.5px] transition",
              openOnly ? "border-junior/50 bg-junior/10 text-junior-text" : "border-line-strong text-ink-2 hover:text-ink",
            )}
          >
            Open now
          </button>
          <Pick
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: "nav", label: "Largest first" },
              { value: "coupon", label: "Highest coupon" },
              { value: "apr", label: "Lowest APR" },
              { value: "threshold", label: "Lowest min revenue" },
            ]}
          />
        </div>

        <div className="mt-6 flex items-center justify-between text-[13px] text-ink-3">
          <span aria-live="polite">
            {q.data ? `${pools.length} of ${q.data.filter((p) => p.status !== "DRAFT").length} pools` : " "}
          </span>
          {filtered && (
            <button type="button" onClick={reset} className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {q.isPending ? (
            Array.from({ length: 6 }, (_, i) => <PoolCardSkeleton key={i} />)
          ) : q.error ? (
            <div className="md:col-span-2 lg:col-span-3">
              <ErrorState error={q.error} onRetry={() => q.refetch()} />
              <div className="mt-4 grid gap-4 opacity-40 md:grid-cols-2 lg:grid-cols-3" aria-hidden>
                <PoolCardSkeleton />
                <PoolCardSkeleton />
                <PoolCardSkeleton />
              </div>
            </div>
          ) : pools.length > 0 ? (
            pools.map((p) => <PoolCard key={p.id} pool={p} />)
          ) : filtered ? (
            <EmptyState
              className="md:col-span-2 lg:col-span-3"
              icon={<SlidersHorizontal />}
              title="No pools match these filters"
              body="Loosen a filter or clear them all to see every pool."
              action={
                <Button size="sm" onClick={reset}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              className="md:col-span-2 lg:col-span-3"
              tone="horizon"
              icon={<Layers />}
              title="No pools are open yet"
              body="Lender companies create pools from their Credent account. Start one and it will appear here once it's raising capital."
              action={
                <ButtonLink href="/signup" variant="horizon" size="sm">
                  Start a pool
                </ButtonLink>
              }
            />
          )}
        </div>
      </Container>
    </>
  );
}
