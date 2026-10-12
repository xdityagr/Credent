"use client";

import { RoleGate } from "@/components/app/kit";
import { OperatingPanel } from "@/components/app/lockbox";
import { SectionPanel, Table } from "@/components/app/portal";
import { PageHeader, Skeleton } from "@/components/ui";
import { date, usd } from "@/lib/format";
import { usePayments } from "@/lib/portal";

export default function PaymentsPage() {
  const q = usePayments();
  return (
    <RoleGate kind="BORROWER">
      <div className="space-y-8">
        <PageHeader title="Payments" description="Every customer payment through your lockbox and how it was split. Private to your company." />
        <OperatingPanel />
        {q.isPending ? (
          <Skeleton className="h-64 w-full rounded-[20px]" />
        ) : (
          <SectionPanel title="Customer payments" description="Newest first.">
            <div className="-mx-5 md:-mx-6">
              <Table
                rows={q.data ?? []}
                rowKey={(p) => p.id}
                empty={<p className="px-6 text-[14px] text-ink-3">No payments yet.</p>}
                columns={[
                  { key: "d", label: "Date", render: (p) => date(p.date) },
                  { key: "a", label: "Amount", align: "right", render: (p) => usd(p.amount, "exact") },
                  { key: "s", label: "To the pool", align: "right", render: (p) => (p.swept ? usd(p.swept, "exact") : "—") },
                  { key: "r", label: "Released to you", align: "right", render: (p) => usd(p.released, "exact") },
                  { key: "l", label: "Loan", render: (p) => p.loan_id ?? "—" },
                ]}
              />
            </div>
          </SectionPanel>
        )}
      </div>
    </RoleGate>
  );
}
