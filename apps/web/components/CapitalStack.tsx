"use client";

import { pct, usd } from "@/lib/format";
import type { PublicPool } from "@/lib/types";

/**
 * The pool's capital stack. Senior sits on top of junior; losses burn upward
 * from the bottom (junior first). Written-down capital stays in the stack as
 * red hatching so the history of losses is visible, not erased.
 */
export function CapitalStack({ pool, height = 340 }: { pool: PublicPool; height?: number }) {
  const { senior: s, junior: j } = pool;
  const segments = [
    { key: "senior", label: "Senior", sub: `${pct(s.coupon_bps ?? 0)} coupon, paid first`, value: s.nav, cls: "bg-senior-mark" },
    { key: "senior-loss", label: "Senior written down", sub: "losses beyond junior", value: s.writedown, cls: "loss-hatch" },
    { key: "junior", label: "Junior", sub: "residual yield, first loss", value: j.nav, cls: "bg-junior-mark" },
    { key: "junior-loss", label: "Junior written down", sub: "absorbed defaults", value: j.writedown, cls: "loss-hatch" },
  ].filter((x) => x.value > 0);
  const total = segments.reduce((a, x) => a + x.value, 0) || 1;
  const cushion = s.nav + j.nav > 0 ? (j.nav * 10_000) / (s.nav + j.nav) : 0;

  return (
    <figure className="grid grid-cols-[88px_1fr] gap-x-5 md:grid-cols-[112px_1fr]">
      <div
        className="flex flex-col gap-[2px] overflow-hidden rounded-[4px]"
        style={{ height }}
        role="img"
        aria-label={`Capital stack: senior ${usd(s.nav)}, junior ${usd(j.nav)}, written down ${usd(s.writedown + j.writedown)}`}
      >
        {segments.map((seg) => (
          <div
            key={seg.key}
            title={`${seg.label}: ${usd(seg.value)}`}
            className={`${seg.cls} min-h-[3px] transition-[flex-grow] duration-700 ease-out`}
            style={{ flexGrow: seg.value, flexBasis: 0 }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-[2px]" style={{ height }}>
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="flex min-h-[44px] flex-col justify-center border-l border-rule pl-4"
            style={{ flexGrow: seg.value, flexBasis: 0 }}
          >
            <div className="flex items-baseline gap-2">
              <span className={`text-[15px] font-semibold ${seg.key.endsWith("loss") ? "text-loss" : "text-ink"}`}>
                {seg.label}
              </span>
              <span className="tabular-nums text-[15px] text-ink">{usd(seg.value)}</span>
              <span className="text-[13px] text-ink-faint">{((seg.value / total) * 100).toFixed(0)}%</span>
            </div>
            <div className="text-[13px] text-ink-faint">{seg.sub}</div>
          </div>
        ))}
      </div>
      <figcaption className="col-span-2 mt-4 text-[14px] leading-relaxed text-ink-soft">
        Senior is protected by {usd(j.nav)} of junior capital ({pct(cushion)} of the pool). Defaults hit
        junior first; senior only loses money once junior is gone.
      </figcaption>
    </figure>
  );
}
