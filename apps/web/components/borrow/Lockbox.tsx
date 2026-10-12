"use client";

import Link from "next/link";
import { usd, pct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { BorrowerView, PublicLoanDetail } from "@/lib/types";
import { EpochStrip } from "../EpochStrip";
import { LedgerFeed } from "../LedgerFeed";
import { Figure, Sheet, StatusTag } from "../ui";
import { RevenueEnvelope } from "./ProveSteps";

/** Borrower dashboard: what you see (private, left) beside what lenders see (public, right). */
export function Lockbox({ view }: { view: BorrowerView }) {
  const loan = view.loan!;
  const st = loan.state;
  const { data: pub } = useApi<PublicLoanDetail>(`/public/loans/${loan.id}`);
  const owed = st.arrears_interest + st.arrears_principal + (st.schedule[st.epoch]?.interest ?? 0) + (st.schedule[st.epoch]?.principal ?? 0);
  const swept = st.swept;
  const closed = loan.status === "DEFAULTED" || loan.status === "REPAID";
  const payments = (view.payments ?? []).filter((p) => p.loan_id === loan.id).slice(0, 14);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
      <div className="space-y-6">
        <SideTitle tone="envelope" title="What you see" note="Only your wallet can load this." />
        <Sheet className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[14px] text-ink-faint">{view.borrower?.business}</div>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-[26px] font-bold tracking-[-0.02em] text-ink">{loan.id}</span>
                <StatusTag status={loan.status} />
              </div>
            </div>
            <Figure label="Outstanding principal" value={usd(st.outstanding)} />
          </div>

          {!closed && (
            <div className="mt-6">
              <div className="flex items-baseline justify-between text-[15px]">
                <span className="font-semibold text-ink">This week&apos;s installment</span>
                <span className="tabular-nums text-ink-soft">
                  {usd(swept)} of {usd(owed)} swept
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-[3px] bg-paper-deep">
                <div
                  className="h-full rounded-[3px] bg-junior-mark transition-[width] duration-500"
                  style={{ width: `${owed ? Math.min(100, (swept / owed) * 100) : 0}%` }}
                />
              </div>
              {st.arrears_interest + st.arrears_principal > 0 && (
                <p className="mt-2 text-[14px] text-warn">
                  Includes {usd(st.arrears_interest + st.arrears_principal)} carried from short weeks. {st.consecutive_short} short
                  in a row; 3 means default.
                </p>
              )}
            </div>
          )}

          <div className="mt-7">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[16px] font-semibold text-ink">Lockbox</h3>
              <span className="text-[14px] text-ink-soft">
                swept {usd(view.totals?.swept ?? 0)}, released {usd(view.totals?.released ?? 0)}
              </span>
            </div>
            {payments.length === 0 ? (
              <p className="py-4 text-[15px] text-ink-faint">
                No customer payments yet. Advance the simulation by a day to see flows arrive.
              </p>
            ) : (
              <ul className="divide-y divide-rule">
                {payments.map((p) => (
                  <li key={p.id} className="sweep-in grid grid-cols-[64px_96px_1fr] items-center gap-3 py-2 text-[14px]">
                    <span className="text-ink-faint">day {p.day}</span>
                    <span className="text-right font-semibold tabular-nums text-ink">{usd(p.amount)}</span>
                    <span className="flex items-center gap-3">
                      <span className="flex h-2.5 flex-1 gap-[2px] overflow-hidden rounded-[2px]">
                        {p.swept > 0 && <span className="bg-junior-mark" style={{ flexGrow: p.swept }} />}
                        {p.released > 0 && <span className="bg-envelope/70" style={{ flexGrow: p.released }} />}
                      </span>
                      <span className="w-[160px] shrink-0 text-[13px] tabular-nums text-ink-soft">
                        {p.swept > 0 ? `${usd(p.swept)} to pool` : "all to you"}
                        {p.swept > 0 && p.released > 0 ? `, ${usd(p.released)} to you` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-5 text-[13px] text-ink-soft">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-junior-mark" /> swept to the pool
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-envelope/70" /> released to you
              </span>
            </div>
          </div>
        </Sheet>
        {view.series && <RevenueEnvelope view={view} />}
      </div>

      <div className="space-y-6">
        <SideTitle tone="ink" title="What lenders see" note="Anyone can load this from the public API." />
        <div className="ledger-sheet rounded-[6px] border border-rule p-6">
          {pub ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <Figure label="Borrower" value={<span className="font-mono text-[18px]">{pub.borrower}</span>} />
                <Figure label="Principal" value={usd(pub.principal)} sub={`${pct(pub.apr_bps, 0)} APR, ${pub.epochs} weeks`} />
                <Figure label="Weekly installment" value={usd(pub.installment)} />
                <Figure label="Proven 90-day revenue" value={pub.threshold ? `≥ ${usd(pub.threshold)}` : "–"} />
              </div>
              <div>
                <div className="mb-2 text-[13px] text-ink-faint">Installments</div>
                <EpochStrip history={pub.history} epochs={pub.epochs} />
              </div>
              {pub.proof_id && (
                <Link href={`/proof/${pub.proof_id}`} className="inline-block text-[15px] font-semibold text-ink underline-offset-2 hover:underline">
                  Verify the revenue proof yourself
                </Link>
              )}
              <div className="border-t border-rule pt-2">
                <LedgerFeed events={[...pub.events].reverse().slice(0, 8)} compact />
              </div>
              <p className="text-[13px] text-ink-faint">
                Not shown to anyone: your revenue, your customer payments, or what was released to you.
              </p>
            </div>
          ) : (
            <p className="text-[15px] text-ink-faint">Loading the public record…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SideTitle({ title, note, tone }: { title: string; note: string; tone: "envelope" | "ink" }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className={`text-[22px] font-bold tracking-[-0.02em] ${tone === "envelope" ? "text-envelope" : "text-ink"}`}>{title}</h2>
      <span className="text-[14px] text-ink-faint">{note}</span>
    </div>
  );
}
