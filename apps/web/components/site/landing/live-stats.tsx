"use client";

import { HorizonArc, NumberSkeleton, StatsGlassBar, Ticker } from "@/components/ui";
import { date, usd } from "@/lib/format";
import { useLive } from "@/lib/live";
import { useStats } from "@/lib/queries";

const money = (n: number) => usd(n, "compact");
const intFmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** Live figures from /public/stats over a horizon arc. Never invented: skeleton or dash until the API answers. */
export function LiveStats() {
  const { data, isPending, error } = useStats();
  const { connected } = useLive();
  const v = (fn: (d: NonNullable<typeof data>) => React.ReactNode) => (data ? fn(data) : isPending ? <NumberSkeleton /> : <span className="text-ink-3">—</span>);

  return (
    <section className="relative -mt-10" aria-label="Live figures">
      <HorizonArc tone="horizon" className="h-[300px] md:h-[360px]" />
      <div className="relative mx-auto -mt-[150px] max-w-[1120px] px-5 md:-mt-[200px] md:px-8">
        <h2 className="mx-auto mb-10 max-w-[22ch] text-center font-serif text-[clamp(32px,4.4vw,56px)] leading-[1.02] tracking-[-0.02em] text-[#f4f1ee]">
          The book, <span className="italic">as it stands</span>
        </h2>
        <StatsGlassBar
          items={[
            { label: "Capital in pools", value: v((d) => <Ticker value={d.total_nav} format={money} />) },
            { label: "Lent and outstanding", value: v((d) => <Ticker value={d.outstanding} format={money} />) },
            { label: "Loans repaid in full", value: v((d) => <Ticker value={d.loans_repaid} format={intFmt} />) },
            { label: "Revenue proofs verified", value: v((d) => <Ticker value={d.proofs_verified} format={intFmt} />) },
          ]}
          footer={
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <span className={connected ? "size-1.5 animate-pulse-dot rounded-full bg-junior-text" : "size-1.5 rounded-full bg-ink-3"} />
                {data
                  ? `Read from the public ledger${data.date ? `, as of ${date(data.date)}` : ""}`
                  : error
                    ? "Live figures appear when the ledger API is reachable"
                    : "Reading the public ledger"}
              </span>
              {data && (
                <span>
                  {data.pools} pools, {data.loans_active} active loans, {data.ledger_events.toLocaleString("en-US")} ledger entries
                </span>
              )}
            </span>
          }
        />
      </div>
    </section>
  );
}
