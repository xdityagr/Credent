"use client";

import { usd } from "@/lib/format";
import type { PublicEvent } from "@/lib/types";

type Step = { label: string; value: number; cls: string; note?: string };

/**
 * Classic waterfall: the first bar is the total, each next bar hangs from where
 * the previous one ended, so you can watch the money (or the loss) get used up.
 */
function Cascade({ steps, total }: { steps: Step[]; total: number }) {
  // Each step after the first starts where the previous ones ended.
  const offsets = steps.map((_, i) => (i === 0 ? 0 : steps.slice(1, i).reduce((a, x) => a + x.value, 0)));
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const left = total ? (offsets[i] / total) * 100 : 0;
        const width = total ? Math.max(0.6, (s.value / total) * 100) : 0;
        return (
          <div key={s.label} className="grid grid-cols-[132px_1fr_92px] items-center gap-3 text-[14px]">
            <span className="text-ink">{s.label}</span>
            <span className="relative h-5 rounded-[2px] bg-paper-deep/60">
              <span
                className={`absolute inset-y-0 rounded-[2px] transition-all duration-700 ${s.cls}`}
                style={{ left: `${i === 0 ? 0 : left}%`, width: `${s.value > 0 ? width : 0}%` }}
                title={`${s.label}: ${usd(s.value, "exact")}`}
              />
            </span>
            <span className="text-right tabular-nums text-ink">{usd(s.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Waterfalls({ interest, loss, recovery }: { interest?: PublicEvent; loss?: PublicEvent; recovery?: PublicEvent }) {
  const ip = interest?.payload as Record<string, number> | undefined;
  const lp = loss?.payload as Record<string, number | string> | undefined;
  const rp = recovery?.payload as Record<string, number | string> | undefined;

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-[16px] font-semibold text-ink">Interest waterfall</h3>
          {interest && <span className="text-[13px] text-ink-faint">settled day {interest.day}</span>}
        </div>
        {ip ? (
          <Cascade
            total={ip.interest}
            steps={[
              { label: "Interest collected", value: ip.interest, cls: "bg-ink-soft" },
              { label: "Protocol fee", value: ip.fee, cls: "bg-ink-faint" },
              { label: "Senior coupon", value: ip.senior, cls: "bg-senior-mark" },
              { label: "Junior residual", value: ip.junior, cls: "bg-junior-mark" },
            ]}
          />
        ) : (
          <p className="text-[15px] text-ink-faint">The first weekly settlement hasn&apos;t happened yet.</p>
        )}
        {ip && ip.senior_arrears > 0 && (
          <p className="mt-2 text-[14px] text-warn">Senior is owed {usd(ip.senior_arrears)} of coupon, carried to next week.</p>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-[16px] font-semibold text-ink">Loss waterfall</h3>
          {loss && <span className="text-[13px] text-ink-faint">{String(lp?.loan_id)}, day {loss.day}</span>}
        </div>
        {lp ? (
          <Cascade
            total={Number(lp.loss)}
            steps={[
              { label: "Principal lost", value: Number(lp.loss), cls: "loss-hatch" },
              { label: "Absorbed by junior", value: Number(lp.junior), cls: "bg-junior-mark" },
              { label: "Absorbed by senior", value: Number(lp.senior), cls: "bg-senior-mark" },
            ]}
          />
        ) : (
          <p className="text-[15px] text-ink-faint">No defaults yet. Losses would hit junior before senior.</p>
        )}
        {rp && (
          <p className="mt-3 text-[14px] text-junior">
            Recovered {usd(Number(rp.amount))} on {String(rp.loan_id)}: senior restored {usd(Number(rp.senior))}, junior{" "}
            {usd(Number(rp.junior))}.
          </p>
        )}
      </div>
    </div>
  );
}
