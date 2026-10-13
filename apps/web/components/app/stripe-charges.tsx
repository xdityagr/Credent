"use client";

import { CreditCard, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Table } from "@/components/app/portal";
import { ErrorState, Skeleton, StatusPill, type StatusTone } from "@/components/ui";
import { dateTime, usd } from "@/lib/format";
import { type StripeCharge, useSourceCharges } from "@/lib/portal";

function status(c: StripeCharge): [StatusTone, string] {
  if (c.status === "failed") return ["loss", "Failed"];
  if (c.status === "pending") return ["pending", "Pending"];
  if (c.amount_refunded >= c.amount && c.amount > 0) return ["neutral", "Refunded"];
  if (c.amount_refunded > 0) return ["warn", "Partial refund"];
  return ["good", "Succeeded"];
}

/**
 * Recent charges on a connected Stripe account, laid out like the Stripe
 * dashboard's Payments list. Owner-only: lenders never see any of this.
 */
export function StripeCharges({ sourceId }: { sourceId: string }) {
  const [limit, setLimit] = useState(8);
  const q = useSourceCharges(sourceId, limit);

  if (q.isPending) return <Skeleton className="h-56 w-full rounded-[16px]" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} compact />;
  const rows = q.data ?? [];
  const succeeded = rows.filter((c) => c.status === "succeeded");
  const net = succeeded.reduce((a, c) => a + c.net, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="flex items-center gap-2 text-[14px] text-ink">
          <CreditCard className="size-4 text-ink-3" /> Recent payments
        </h4>
        <span className="text-[12.5px] text-ink-3">
          {succeeded.length} of {rows.length} succeeded · <span className="num text-ink-2">{usd(net, "exact")}</span> net
        </span>
      </div>
      <div className="rounded-[16px] border border-line">
        <Table
          rows={rows}
          rowKey={(c) => c.id}
          empty={<p className="p-5 text-[13.5px] text-ink-3">No charges yet.</p>}
          columns={[
            {
              key: "amount",
              label: "Amount",
              render: (c) => (
                <span className={c.status === "failed" ? "num whitespace-nowrap text-ink-3 line-through decoration-ink-3/60" : "num whitespace-nowrap"}>
                  {usd(c.amount, "exact")} <span className="text-[11.5px] uppercase text-ink-3">{c.currency}</span>
                </span>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (c) => {
                const [tone, label] = status(c);
                return (
                  <span title={c.failure_message ?? (c.amount_refunded ? `${usd(c.amount_refunded, "exact")} refunded` : undefined)}>
                    <StatusPill tone={tone}>{label}</StatusPill>
                  </span>
                );
              },
            },
            {
              key: "desc",
              label: "Description",
              render: (c) => (
                <span className="block max-w-[260px] truncate text-ink-2" title={c.description ?? undefined}>
                  {c.description ?? "—"}
                </span>
              ),
            },
            {
              key: "customer",
              label: "Customer",
              render: (c) => <span className="whitespace-nowrap text-ink-2">{c.customer ?? "—"}</span>,
            },
            {
              key: "card",
              label: "Payment method",
              render: (c) => <span className="whitespace-nowrap font-mono text-[12.5px] text-ink-2">{c.card ?? "—"}</span>,
            },
            {
              key: "date",
              label: "Date",
              render: (c) => (
                <span className="whitespace-nowrap text-ink-3">{dateTime(new Date(c.created * 1000).toISOString())}</span>
              ),
            },
            {
              key: "receipt",
              label: "",
              align: "right",
              render: (c) =>
                c.receipt_url && !c.id.startsWith("ch_sbx_") ? (
                  <a href={c.receipt_url} target="_blank" rel="noreferrer" aria-label="Receipt" className="text-ink-3 hover:text-ink">
                    <ExternalLink className="inline size-3.5" />
                  </a>
                ) : (
                  <span className="font-mono text-[11.5px] text-ink-3" title="Charge ID">
                    {c.id.slice(-6)}
                  </span>
                ),
            },
          ]}
        />
      </div>
      {rows.length >= limit && limit < 100 && (
        <button type="button" onClick={() => setLimit(limit < 25 ? 25 : 100)} className="text-[13px] text-ink-2 hover:text-ink">
          Show more payments
        </button>
      )}
    </div>
  );
}
