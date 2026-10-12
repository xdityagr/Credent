"use client";

import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RoleGate } from "@/components/app/kit";
import { LockboxFeed, OperatingPanel } from "@/components/app/lockbox";
import { LoanSummary, SectionPanel, Table } from "@/components/app/portal";
import { ErrorState, PageHeader, Panel, Skeleton, Stat, StatusPill } from "@/components/ui";
import { usd } from "@/lib/format";
import { useMyLoan } from "@/lib/portal";

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useMyLoan(id);
  const loan = q.data;
  return (
    <RoleGate kind="BORROWER">
      <div className="space-y-8">
        <Link href="/app/loans" className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-3 hover:text-ink">
          <ArrowLeft className="size-3.5" /> All loans
        </Link>
        {q.isPending ? (
          <Skeleton className="h-72 w-full rounded-[20px]" />
        ) : !loan ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            <PageHeader
              title={`Loan ${loan.id}`}
              description="You see everything below. Lenders see only the public record: principal, installments paid or short, and status."
              actions={
                <Link href={`/explorer?loan=${loan.id}`} className="inline-flex items-center gap-1 text-[13.5px] text-horizon-2 hover:text-white">
                  Public record <ArrowUpRight className="size-3.5" />
                </Link>
              }
            />
            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <div className="space-y-6">
                <Panel className="p-5 md:p-6"><LoanSummary loan={loan} /></Panel>
                <SectionPanel
                  title="Lockbox"
                  description={`${loan.totals.count} customer payments since drawdown. ${usd(loan.totals.swept)} repaid the pool, ${usd(loan.totals.released)} released to you.`}
                  action={<StatusPill tone="private">Only you</StatusPill>}
                >
                  <LockboxFeed payments={loan.payments} />
                </SectionPanel>
              </div>
              <div className="space-y-6">
                <OperatingPanel />
                <SectionPanel title="Schedule" description={`${loan.epochs} level weekly installments.`}>
                  <div className="-mx-5 md:-mx-6">
                    <Table
                      rows={loan.schedule}
                      rowKey={(r) => r.epoch}
                      columns={[
                        {
                          key: "w",
                          label: "Week",
                          render: (r) => {
                            const h = loan.history[r.epoch];
                            return (
                              <span className="flex items-center gap-2">
                                {r.epoch + 1}
                                {h && <StatusPill tone={h.event === "InstallmentPaid" ? "good" : "warn"}>{h.event === "InstallmentPaid" ? "Paid" : "Short"}</StatusPill>}
                                {!h && r.epoch === loan.epoch && <StatusPill tone="pending">This week</StatusPill>}
                              </span>
                            );
                          },
                        },
                        { key: "i", label: "Interest", align: "right", render: (r) => usd(r.interest, "exact") },
                        { key: "p", label: "Principal", align: "right", render: (r) => usd(r.principal, "exact") },
                        { key: "t", label: "Total", align: "right", render: (r) => usd(r.total, "exact") },
                      ]}
                    />
                  </div>
                </SectionPanel>
                <Panel className="grid grid-cols-2 gap-4 p-5 md:p-6">
                  <Stat label="Drawn" value={loan.drawn_date} />
                  <Stat label="Due now" value={<span className="num">{usd(loan.due_now)}</span>} />
                </Panel>
              </div>
            </div>
          </>
        )}
      </div>
    </RoleGate>
  );
}
