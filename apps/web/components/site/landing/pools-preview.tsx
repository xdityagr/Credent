"use client";

import { Layers } from "lucide-react";
import { PoolCard, PoolCardSkeleton } from "@/components/data/pool-card";
import { ButtonLink, EmptyState } from "@/components/ui";
import { usePools } from "@/lib/queries";

export function PoolsPreview() {
  const { data, isPending, error } = usePools();
  const top = (data ?? [])
    .filter((p) => p.status !== "DRAFT")
    .sort((a, b) => b.total_nav - a.total_nav)
    .slice(0, 3);

  return (
    <section className="relative mx-auto max-w-[1280px] px-5 py-20 md:px-8 md:py-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="max-w-[16ch] font-serif text-[clamp(40px,5.4vw,72px)] leading-[0.98] tracking-[-0.03em] text-[#f4f1ee]">
            Pools open <span className="italic text-ink-2">right now</span>
          </h2>
          <p className="mt-4 max-w-[48ch] text-[16px] leading-relaxed text-ink-2">
            Each pool is run by a lender company with its own terms. Pick by coupon, borrower APR, term or the minimum revenue
            it lends against.
          </p>
        </div>
        <ButtonLink href="/pools" variant="glass" magnetic>
          See all pools
        </ButtonLink>
      </div>

      <div className={`mt-12 grid gap-4 md:grid-cols-2 ${top.length === 2 ? "" : "lg:grid-cols-3"}`}>
        {isPending ? (
          <>
            <PoolCardSkeleton />
            <PoolCardSkeleton />
            <PoolCardSkeleton />
          </>
        ) : top.length > 0 ? (
          top.map((p) => <PoolCard key={p.id} pool={p} />)
        ) : (
          <EmptyState
            className="md:col-span-2 lg:col-span-3"
            tone="horizon"
            icon={<Layers />}
            title={error ? "Pools will appear here when the API is reachable" : "No pools are open yet"}
            body="Lender companies open pools from their Credent account. The first one will show up here with its terms and capital stack."
            action={
              <ButtonLink href="/signup" variant="horizon" size="sm">
                Start a pool
              </ButtonLink>
            }
          />
        )}
      </div>
    </section>
  );
}
