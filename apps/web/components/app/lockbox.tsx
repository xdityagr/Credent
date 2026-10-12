"use client";

import { ArrowUpFromLine } from "lucide-react";
import { motion } from "motion/react";
import { Button, Stat, toast } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { date, usd } from "@/lib/format";
import { type Payment, useBorrowerActions, useOperating } from "@/lib/portal";
import { SectionPanel } from "./portal";

/** Each customer payment splits into "to the pool" (installment) and "to you" (operating balance). */
export function LockboxFeed({ payments, limit = 16 }: { payments: Payment[]; limit?: number }) {
  if (payments.length === 0) {
    return <p className="py-4 text-[14px] text-ink-3">No customer payments yet. They appear as your business gets paid.</p>;
  }
  return (
    <div>
      <ul className="divide-y divide-line/70">
        {payments.slice(0, limit).map((p) => (
          <motion.li
            key={p.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-[88px_100px_1fr] items-center gap-3 py-2.5 text-[13.5px] sm:grid-cols-[96px_110px_1fr_200px]"
          >
            <span className="text-ink-3">{date(p.date)}</span>
            <span className="num text-right text-ink">{usd(p.amount, "exact")}</span>
            <span className="flex h-2 gap-[2px] overflow-hidden rounded-full" aria-hidden>
              {p.swept > 0 && <span className="bg-junior" style={{ flexGrow: p.swept }} />}
              {p.released > 0 && <span className="bg-ember-1/70" style={{ flexGrow: p.released }} />}
            </span>
            <span className="col-span-3 text-[12.5px] text-ink-3 sm:col-span-1 sm:text-right">
              {p.swept > 0 ? `${usd(p.swept, "exact")} to the pool` : "All to you"}
              {p.swept > 0 && p.released > 0 ? `, ${usd(p.released, "exact")} to you` : ""}
            </span>
          </motion.li>
        ))}
      </ul>
      <div className="mt-4 flex gap-5 text-[12.5px] text-ink-3">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-junior" /> repays the installment</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ember-1/70" /> released to you</span>
      </div>
    </div>
  );
}

export function OperatingPanel() {
  const q = useOperating();
  const a = useBorrowerActions();
  const o = q.data;
  return (
    <SectionPanel
      title="Operating balance"
      description="What's left of customer payments after installments. Today's inflows settle overnight."
      action={
        <Button
          size="sm"
          variant="ember"
          icon={<ArrowUpFromLine className="size-3.5" />}
          busy={a.withdrawOperating.isPending}
          disabled={!o || o.available <= 0}
          onClick={() =>
            a.withdrawOperating.mutate(null, {
              onSuccess: (r) => toast.success(`${usd(r.amount)} sent to your wallet`),
              onError: (e) => toast.error("Withdrawal failed", { description: errorMessage(e) }),
            })
          }
        >
          Withdraw to wallet
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Available" value={<span className="num">{usd(o?.available)}</span>} />
        <Stat label="Settling" value={<span className="num">{usd(o?.settling)}</span>} />
        <Stat label="Total" value={<span className="num">{usd(o?.balance)}</span>} />
      </div>
    </SectionPanel>
  );
}
