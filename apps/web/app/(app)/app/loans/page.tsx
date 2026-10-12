"use client";

import { RoleGate } from "@/components/app/kit";
import { OperatingPanel } from "@/components/app/lockbox";
import { LoanSummary, NoLoanYet } from "@/components/app/portal";
import { PageHeader, Panel, Skeleton } from "@/components/ui";
import { useMyLoans } from "@/lib/portal";

export default function LoansPage() {
  const q = useMyLoans();
  return (
    <RoleGate kind="BORROWER">
      <div className="space-y-8">
        <PageHeader title="Loans" description="Active and past loans. Installments are collected from incoming customer payments." />
        {q.isPending ? (
          <Skeleton className="h-56 w-full rounded-[20px]" />
        ) : (q.data ?? []).length === 0 ? (
          <NoLoanYet />
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {q.data!.map((l) => (
              <Panel key={l.id} className="p-5 md:p-6">
                <LoanSummary loan={l} />
              </Panel>
            ))}
          </div>
        )}
        <OperatingPanel />
      </div>
    </RoleGate>
  );
}
