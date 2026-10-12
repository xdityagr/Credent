import { cn } from "@/lib/cn";
import { usd } from "@/lib/format";
import type { PublicEvent } from "@/lib/types";

type Step = { label: string; value: number; cls: string };

/** The first bar is the total; each next bar hangs from where the previous ended. */
export function Cascade({ steps, total }: { steps: Step[]; total: number }) {
  const offsets = steps.map((_, i) => (i === 0 ? 0 : steps.slice(1, i).reduce((a, x) => a + x.value, 0)));
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const left = total ? (offsets[i] / total) * 100 : 0;
        const width = total ? Math.max(0.8, (s.value / total) * 100) : 0;
        return (
          <div key={s.label} className="grid grid-cols-[120px_1fr_84px] items-center gap-3 text-[13.5px] md:grid-cols-[140px_1fr_96px]">
            <span className="text-ink-2">{s.label}</span>
            <span className="relative h-4 rounded-[4px] bg-white/[0.04]">
              <span
                className={cn("absolute inset-y-0 rounded-[4px] transition-all duration-700", s.cls)}
                style={{ left: `${i === 0 ? 0 : left}%`, width: `${s.value > 0 ? width : 0}%` }}
                title={`${s.label}: ${usd(s.value, "exact")}`}
              />
            </span>
            <span className="num text-right text-ink">{usd(s.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Interest and loss waterfalls from the latest ledger events. */
export function Waterfalls({ interest, loss }: { interest?: PublicEvent; loss?: PublicEvent }) {
  const ip = interest?.payload as Record<string, number> | undefined;
  const lp = loss?.payload as Record<string, number | string> | undefined;
  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-[14px] text-ink">Interest waterfall</h3>
        {ip ? (
          <Cascade
            total={ip.interest}
            steps={[
              { label: "Interest collected", value: ip.interest, cls: "bg-ink-2" },
              { label: "Protocol fee", value: ip.fee, cls: "bg-ink-3" },
              { label: "Senior coupon", value: ip.senior, cls: "bg-senior" },
              { label: "Junior residual", value: ip.junior, cls: "bg-junior" },
            ]}
          />
        ) : (
          <p className="text-[14px] text-ink-3">No weekly settlement yet. Interest pays the fee, then the senior coupon, then junior.</p>
        )}
      </div>
      <div>
        <h3 className="mb-3 text-[14px] text-ink">Loss waterfall</h3>
        {lp ? (
          <Cascade
            total={Number(lp.loss)}
            steps={[
              { label: "Principal lost", value: Number(lp.loss), cls: "loss-hatch" },
              { label: "Absorbed by junior", value: Number(lp.junior), cls: "bg-junior" },
              { label: "Absorbed by senior", value: Number(lp.senior), cls: "bg-senior" },
            ]}
          />
        ) : (
          <p className="text-[14px] text-ink-3">No defaults. A loss would be absorbed by junior before senior.</p>
        )}
      </div>
    </div>
  );
}
