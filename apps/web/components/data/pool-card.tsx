import Link from "next/link";
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { OrgAvatar, PoolStatusPill, Skeleton, SpotlightCard, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { pct, usd, weeks } from "@/lib/format";
import type { PublicPool } from "@/lib/types";

export function ReservesBadge({ reserves }: { reserves: PublicPool["reserves"] }) {
  if (reserves.ok === true)
    return (
      <StatusPill tone="good" icon={false}>
        <ShieldCheck className="size-3.5" aria-hidden /> Reserves verified on Solana
      </StatusPill>
    );
  if (reserves.ok === false)
    return (
      <StatusPill tone="loss">Reserves don&apos;t match the book</StatusPill>
    );
  return (
    <StatusPill tone="pending" icon={false}>
      <ShieldQuestion className="size-3.5" aria-hidden /> Reserves not checked yet
    </StatusPill>
  );
}

/** Thin senior/junior split bar (2px gap, validated marks). */
export function TrancheBar({ senior, junior, className }: { senior: number; junior: number; className?: string }) {
  const total = senior + junior;
  if (total <= 0) return <div className={cn("h-1.5 rounded-full bg-white/[0.06]", className)} />;
  return (
    <div className={cn("flex h-1.5 gap-[2px] overflow-hidden rounded-full", className)} role="img" aria-label={`Senior ${Math.round((senior / total) * 100)}%, junior ${Math.round((junior / total) * 100)}%`}>
      <span className="rounded-l-full bg-senior" style={{ flexGrow: senior, flexBasis: 0 }} />
      <span className="rounded-r-full bg-junior" style={{ flexGrow: junior, flexBasis: 0 }} />
    </div>
  );
}

export function PoolCard({ pool, className }: { pool: PublicPool; className?: string }) {
  const filled = pool.target_size > 0 ? Math.min(100, (pool.total_nav / pool.target_size) * 100) : 0;
  return (
    <SpotlightCard tone="horizon" cursorLabel="View" as="article" className={cn("flex flex-col", className)}>
      <Link href={`/pools/${pool.slug}`} className="flex h-full flex-col p-6 outline-none focus-visible:ring-2 focus-visible:ring-rim rounded-[24px]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <OrgAvatar name={pool.manager.name} src={pool.manager.logo_url} kind="LENDER" size={28} />
            <span className="truncate text-[13px] text-ink-2">{pool.manager.name}</span>
          </span>
          <PoolStatusPill status={pool.status} />
        </div>
        <h3 className="mt-5 text-[19px] font-medium leading-snug tracking-[-0.01em] text-ink">{pool.name}</h3>
        {pool.description && <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{pool.description}</p>}

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <div className="font-display text-[30px] font-extralight leading-none tracking-[-0.03em] text-ink">
              {pct(pool.senior.coupon_bps)}
            </div>
            <div className="mt-2 text-[12.5px] text-ink-3">Senior coupon</div>
          </div>
          <div>
            <div className="font-display text-[30px] font-extralight leading-none tracking-[-0.03em] text-ink">
              {pct(pool.borrower_apr_bps)}
            </div>
            <div className="mt-2 text-[12.5px] text-ink-3">Borrower APR</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between text-[12.5px]">
            <span className="text-ink-3">
              <span className="num text-ink">{usd(pool.total_nav, "compact")}</span> of {usd(pool.target_size, "compact")}
            </span>
            <span className="num text-ink-3">{filled.toFixed(0)}% raised</span>
          </div>
          <TrancheBar senior={pool.senior.nav} junior={pool.junior.nav} />
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5 text-[12.5px]">
          <div>
            <dt className="text-ink-3">Term</dt>
            <dd className="mt-1 text-ink">{weeks(pool.term_epochs)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Min revenue</dt>
            <dd className="num mt-1 text-ink">{usd(pool.min_threshold, "compact")}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Max loan</dt>
            <dd className="num mt-1 text-ink">{usd(pool.max_loan, "compact")}</dd>
          </div>
        </dl>
        <div className="mt-auto pt-5">
          <ReservesBadge reserves={pool.reserves} />
        </div>
      </Link>
    </SpotlightCard>
  );
}

export function PoolCardSkeleton() {
  return (
    <div className="flex flex-col rounded-[24px] border border-line bg-raised p-6">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-7 rounded-[30%]" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="mt-6 h-5 w-3/4" />
      <Skeleton className="mt-2 h-3 w-full" />
      <div className="mt-7 grid grid-cols-2 gap-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="mt-7 h-1.5 w-full rounded-full" />
      <div className="mt-7 grid grid-cols-3 gap-3 border-t border-line pt-5">
        <Skeleton className="h-3" />
        <Skeleton className="h-3" />
        <Skeleton className="h-3" />
      </div>
    </div>
  );
}
