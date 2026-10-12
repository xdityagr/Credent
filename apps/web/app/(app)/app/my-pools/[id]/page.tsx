"use client";

import { ArrowLeft, ArrowUpRight, Lock, PlayCircle, Rocket, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { RoleGate } from "@/components/app/kit";
import { DepositDialog, SectionPanel, Table } from "@/components/app/portal";
import { ReviewCard } from "@/components/app/review";
import { CapitalStack } from "@/components/data/capital-stack";
import { LoansTable } from "@/components/data/loans-table";
import { NavChart } from "@/components/data/nav-chart";
import { ReservesBadge } from "@/components/data/pool-card";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Panel,
  PoolStatusPill,
  Skeleton,
  Stat,
  Tabs,
  TabsContent,
  TabsList,
  Textarea,
  toast,
} from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { pct, usd } from "@/lib/format";
import { type ManagedPool, useLenderActions, useMyPool } from "@/lib/portal";

function Lifecycle({ pool }: { pool: ManagedPool }) {
  const a = useLenderActions();
  const [depositing, setDepositing] = useState(false);
  const run = (m: typeof a.fund, label: string) =>
    m.mutate(pool.id, { onSuccess: () => toast.success(label), onError: (e) => toast.error(errorMessage(e)) });
  const juniorShort = Math.max(0, pool.min_first_loss - pool.junior.nav);

  const step =
    pool.status === "DRAFT"
      ? { title: "Start funding", body: "Publishes your terms to the ledger and opens the vault for deposits. Economic terms lock after this.", action: <Button variant="horizon" icon={<Rocket className="size-4" />} busy={a.fund.isPending} onClick={() => run(a.fund, "Pool is funding")}>Start funding</Button> }
      : pool.status === "FUNDING"
        ? {
            title: juniorShort > 0 ? "Deposit first-loss capital" : "Open for applications",
            body: juniorShort > 0 ? `Deposit at least ${usd(juniorShort)} more into junior. It protects senior investors and is required before borrowers can apply.` : "Junior is funded. Open the pool and borrowers can apply with their proofs.",
            action: juniorShort > 0
              ? <Button variant="horizon" icon={<Wallet className="size-4" />} onClick={() => setDepositing(true)}>Deposit junior</Button>
              : <Button variant="horizon" icon={<PlayCircle className="size-4" />} busy={a.open.isPending} onClick={() => run(a.open, "Pool is open for applications")}>Open for applications</Button>,
          }
        : pool.status === "OPEN"
          ? { title: "Open for applications", body: "Borrowers can apply. New applications land in your review queue.", action: <Button variant="ghost" icon={<Lock className="size-4" />} busy={a.close.isPending} onClick={() => run(a.close, "Pool closed to new loans")}>Close to new loans</Button> }
          : { title: "Closed", body: "No new loans or deposits. Existing loans keep repaying and investors can withdraw.", action: null };

  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
      <div className="max-w-xl">
        <div className="text-[15px] text-ink">{step.title}</div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{step.body}</p>
      </div>
      <div className="flex gap-2">
        {pool.status !== "DRAFT" && pool.status !== "CLOSED" && (pool.status === "OPEN" || juniorShort === 0) && (
          <Button variant="ghost" icon={<Wallet className="size-4" />} onClick={() => setDepositing(true)}>Deposit</Button>
        )}
        {step.action}
      </div>
      <DepositDialog pool={pool} open={depositing} onOpenChange={setDepositing} defaultTranche="junior" />
    </Panel>
  );
}

function Settings({ pool }: { pool: ManagedPool }) {
  const a = useLenderActions();
  const [name, setName] = useState(pool.name);
  const [description, setDescription] = useState(pool.description ?? "");
  const [auto, setAuto] = useState(pool.auto_approve);
  return (
    <SectionPanel title="Pool settings" description={pool.status === "DRAFT" ? "Everything is editable while the pool is a draft." : "Economic terms are locked; you can still edit the name, description and auto-approval."}>
      <div className="max-w-xl space-y-4">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <label className="flex items-center gap-3 text-[14px] text-ink">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[#8fb4ff]" /> Approve qualifying applications automatically
        </label>
        <Button
          variant="horizon"
          busy={a.update.isPending}
          onClick={() =>
            a.update.mutate(
              { id: pool.id, patch: { name, description, auto_approve: auto } },
              { onSuccess: () => toast.success("Pool updated"), onError: (e) => toast.error(errorMessage(e)) },
            )
          }
        >
          Save changes
        </Button>
      </div>
    </SectionPanel>
  );
}

export default function ManagedPoolPage() {
  const { id } = useParams<{ id: string }>();
  const q = useMyPool(id);
  const [tab, setTab] = useState("overview");
  const pool = q.data;
  const pending = (pool?.applications ?? []).filter((a) => a.status === "SUBMITTED");
  return (
    <RoleGate kind="LENDER">
      <div className="space-y-8">
        <Link href="/app/my-pools" className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-3 hover:text-ink">
          <ArrowLeft className="size-3.5" /> My pools
        </Link>
        {q.isPending ? (
          <Skeleton className="h-72 w-full rounded-[20px]" />
        ) : !pool ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            <PageHeader
              title={pool.name}
              kicker={<span className="flex items-center gap-2"><PoolStatusPill status={pool.status} /><ReservesBadge reserves={pool.reserves} /></span>}
              description={pool.description || undefined}
              actions={pool.status !== "DRAFT" && (
                <Link href={`/pools/${pool.slug}`} className="inline-flex items-center gap-1 text-[13.5px] text-horizon-2 hover:text-white">
                  Public page <ArrowUpRight className="size-3.5" />
                </Link>
              )}
            />
            <Lifecycle pool={pool} />
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList
                value={tab}
                items={[
                  { value: "overview", label: "Overview" },
                  { value: "applications", label: "Applications", count: pending.length || undefined },
                  { value: "loans", label: "Loans", count: pool.loans.length || undefined },
                  { value: "investors", label: "Investors", count: pool.investors.length || undefined },
                  { value: "settings", label: "Settings" },
                ]}
              />
              <TabsContent value="overview" className="mt-6">
                <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                  <Panel className="p-5 md:p-6">
                    <h2 className="mb-5 text-[16px] text-ink">Capital stack</h2>
                    <CapitalStack pool={pool} height={260} />
                  </Panel>
                  <div className="space-y-6">
                    <Panel className="grid grid-cols-2 gap-5 p-5 md:grid-cols-3 md:p-6">
                      <Stat label="Net assets" value={<span className="num">{usd(pool.total_nav)}</span>} />
                      <Stat label="Idle in vault" value={<span className="num">{usd(pool.cash)}</span>} />
                      <Stat label="Lent out" value={<span className="num">{usd(pool.outstanding)}</span>} />
                      <Stat label="Senior coupon" value={pct(pool.senior.coupon_bps)} />
                      <Stat label="Borrower APR" value={pct(pool.borrower_apr_bps)} />
                      <Stat label="Leverage" value={`${(pool.leverage_x100 / 100).toFixed(2)}x of ${(pool.max_leverage_x100 / 100).toFixed(2)}x`} />
                      <Stat label="Advance rate" value={pct(pool.advance_bps, 0)} />
                      <Stat label="Min. proven revenue" value={<span className="num">{usd(pool.min_threshold)}</span>} />
                      <Stat label="Protocol fees paid" value={<span className="num">{usd(pool.treasury ?? 0)}</span>} />
                    </Panel>
                    <Panel className="p-5 md:p-6">
                      <h2 className="mb-4 text-[16px] text-ink">Tranche share prices</h2>
                      {pool.nav_history.length ? <NavChart points={pool.nav_history} height={200} /> : <p className="text-[14px] text-ink-3">Prices appear after the first weekly settlement.</p>}
                    </Panel>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="applications" className="mt-6">
                {pool.applications.length === 0 ? (
                  <EmptyState tone="horizon" title="No applications yet" body={pool.status === "OPEN" ? "Borrowers who apply to this pool appear here." : "Open the pool to start receiving applications."} />
                ) : (
                  <div className="grid gap-6 xl:grid-cols-2">{pool.applications.map((a) => <ReviewCard key={a.id} app={a} />)}</div>
                )}
              </TabsContent>
              <TabsContent value="loans" className="mt-6">
                {pool.loans.length === 0 ? <EmptyState tone="horizon" title="No loans yet" body="Approved borrowers who sign their terms draw from this pool's vault." /> : <LoansTable loans={pool.loans} />}
              </TabsContent>
              <TabsContent value="investors" className="mt-6">
                <SectionPanel title="Investors" description="Who holds each tranche. Lenders are public by design; borrowers never are.">
                  <div className="-mx-5 md:-mx-6">
                    <Table
                      rows={pool.investors}
                      rowKey={(r) => `${r.pseudonym}-${r.tranche}`}
                      empty={<p className="px-6 text-[14px] text-ink-3">No deposits yet.</p>}
                      columns={[
                        { key: "o", label: "Investor", render: (r) => <span>{r.org} <span className="font-mono text-[12px] text-ink-3">{r.pseudonym}</span></span> },
                        { key: "t", label: "Tranche", render: (r) => <span className="capitalize">{r.tranche}</span> },
                        { key: "d", label: "Deposited", align: "right", render: (r) => usd(r.deposited) },
                        { key: "w", label: "Withdrawn", align: "right", render: (r) => usd(r.withdrawn) },
                      ]}
                    />
                  </div>
                </SectionPanel>
              </TabsContent>
              <TabsContent value="settings" className="mt-6">
                <Settings pool={pool} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </RoleGate>
  );
}
