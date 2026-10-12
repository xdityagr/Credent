"use client";

import { ArrowUpRight, Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, OrgAvatar, Panel, Stat, StatusPill, Textarea, toast } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { date, pct, usd } from "@/lib/format";
import { type ApplicationView, useLenderActions } from "@/lib/portal";

/** A borrower application as the reviewing pool manager sees it: who they are, what they proved, what they want. */
export function ReviewCard({ app }: { app: ApplicationView }) {
  const a = useLenderActions();
  const [note, setNote] = useState("");
  const b = app.borrower;
  const tr = b.track_record;
  const pending = app.status === "SUBMITTED";

  const decide = (approve: boolean) =>
    (approve ? a.approve : a.decline).mutate(
      { id: app.id, note },
      {
        onSuccess: () => toast.success(approve ? "Approved. The borrower can now sign and draw." : "Declined"),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <Panel className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <OrgAvatar name={b.name ?? b.pseudonym} src={b.logo_url ?? null} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[16px] text-ink">{b.name ?? b.pseudonym}</span>
              <Badge>{b.pseudonym}</Badge>
            </div>
            <p className="text-[13px] text-ink-3">
              {[b.sector, b.country].filter(Boolean).join(", ")}
              {b.website && (
                <>
                  {", "}
                  <a href={b.website} target="_blank" rel="noreferrer" className="hover:text-ink">{b.website.replace(/^https?:\/\//, "")}</a>
                </>
              )}
            </p>
          </div>
        </div>
        <StatusPill tone={pending ? "pending" : app.status === "DECLINED" ? "loss" : "good"}>
          {pending ? "Awaiting your decision" : app.status.toLowerCase()}
        </StatusPill>
      </div>
      {b.description && <p className="mt-4 text-[14px] leading-relaxed text-ink-2">{b.description}</p>}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Requested" value={<span className="num">{usd(app.requested)}</span>} />
        <Stat
          label="Proven 90-day revenue"
          value={
            <Link href={`/proofs/${app.proof.id}`} className="inline-flex items-center gap-1 text-horizon-2 hover:text-white">
              ≥ {usd(app.proof.threshold)} <ArrowUpRight className="size-3" />
            </Link>
          }
        />
        <Stat label="Weekly installment" value={<span className="num">{usd(app.terms.installment)}</span>} />
        <Stat
          label="Revenue source"
          value={
            app.proof.source_kind === "STRIPE" ? "Stripe (test mode)" : app.proof.source_kind === "RECEIPTS" ? "Signed receipts" : app.proof.source_kind === "DEMO" ? <span className="text-warn">Demo business (simulated)</span> : "—"
          }
        />
        <Stat label="Pool" value={app.pool.name} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-3">
        <span>Advance used: {pct(Math.round((app.requested * 10_000) / Math.max(1, app.proof.threshold)), 0)} of proven revenue</span>
        {tr && <span>Credent history: {tr.loans} loans, {tr.repaid} repaid, {tr.defaulted} defaulted, {tr.active} active</span>}
        <span>Applied {date(app.created_at)}</span>
      </div>
      {pending && (
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the borrower (optional)" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} busy={a.decline.isPending} onClick={() => decide(false)}>Decline</Button>
            <Button size="sm" variant="horizon" icon={<Check className="size-3.5" />} busy={a.approve.isPending} onClick={() => decide(true)}>Approve</Button>
          </div>
        </div>
      )}
      {!pending && app.decision_note && <p className="mt-4 text-[13.5px] text-ink-2">Note: {app.decision_note}</p>}
    </Panel>
  );
}
