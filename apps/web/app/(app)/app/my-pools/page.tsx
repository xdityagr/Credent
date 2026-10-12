"use client";

import { Layers, Plus } from "lucide-react";
import Link from "next/link";
import { RoleGate } from "@/components/app/kit";
import { ReservesBadge, TrancheBar } from "@/components/data/pool-card";
import { ButtonLink, EmptyState, PageHeader, Panel, PoolStatusPill, Skeleton, Stat } from "@/components/ui";
import { pct, usd } from "@/lib/format";
import { useMyPools } from "@/lib/portal";

const NEXT_STEP: Record<string, string> = {
  DRAFT: "Draft: review terms, then start funding.",
  FUNDING: "Funding: deposit first-loss junior capital, then open for applications.",
  OPEN: "Open: taking applications.",
  CLOSED: "Closed to new loans and deposits.",
};

export default function MyPoolsPage() {
  const q = useMyPools();
  return (
    <RoleGate kind="LENDER">
      <div className="space-y-8">
        <PageHeader
          title="My pools"
          description="Pools you manage: your terms, your first-loss capital, your approvals."
          actions={<ButtonLink href="/app/my-pools/new" variant="horizon" icon={<Plus className="size-4" />}>Create a pool</ButtonLink>}
        />
        {q.isPending ? (
          <Skeleton className="h-56 w-full rounded-[20px]" />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            tone="horizon"
            icon={<Layers />}
            title="You don't manage a pool yet"
            body="Set the coupon, borrower APR, advance rate and minimum proven revenue. Fund the junior tranche and open it for applications."
            action={<ButtonLink href="/app/my-pools/new" size="sm" variant="horizon">Create a pool</ButtonLink>}
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {q.data!.map((p) => (
              <Link key={p.id} href={`/app/my-pools/${p.id}`} className="block">
                <Panel className="p-5 transition hover:border-line-strong md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[17px] text-ink">{p.name}</span>
                        <PoolStatusPill status={p.status} />
                      </div>
                      <p className="mt-1 text-[13px] text-ink-3">{NEXT_STEP[p.status]}</p>
                    </div>
                    <ReservesBadge reserves={p.reserves} />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat label="Net assets" value={<span className="num">{usd(p.total_nav)}</span>} />
                    <Stat label="Lent out" value={<span className="num">{usd(p.outstanding)}</span>} />
                    <Stat label="Utilization" value={pct(p.utilization_bps, 0)} />
                    <Stat label="Active loans" value={p.loans_active} />
                  </div>
                  <TrancheBar senior={p.senior.nav} junior={p.junior.nav} className="mt-5" />
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </RoleGate>
  );
}
