import { cn } from "@/lib/cn";
import { pct, usd } from "@/lib/format";

export interface StackInput {
  senior: { nav: number; writedown: number; coupon_bps?: number | null };
  junior: { nav: number; writedown: number };
}

/**
 * Capital stack: senior sits on junior; losses burn upward from the bottom.
 * Written-down capital stays visible as hatching. Marks use the validated data
 * colours; labels stay in ink. A 2px gap separates segments.
 */
export function CapitalStack({ pool, height = 300, className }: { pool: StackInput; height?: number; className?: string }) {
  const { senior: s, junior: j } = pool;
  const segments = [
    { key: "senior", label: "Senior", sub: `${pct(s.coupon_bps ?? 0)} fixed coupon, paid first`, value: s.nav, cls: "bg-senior", swatch: "bg-senior" },
    { key: "senior-loss", label: "Senior written down", sub: "losses beyond junior", value: s.writedown, cls: "loss-hatch", swatch: "loss-hatch" },
    { key: "junior", label: "Junior", sub: "residual yield, takes first loss", value: j.nav, cls: "bg-junior", swatch: "bg-junior" },
    { key: "junior-loss", label: "Junior written down", sub: "absorbed defaults", value: j.writedown, cls: "loss-hatch", swatch: "loss-hatch" },
  ].filter((x) => x.value > 0);
  const total = segments.reduce((a, x) => a + x.value, 0);
  const cushion = s.nav + j.nav > 0 ? (j.nav * 10_000) / (s.nav + j.nav) : 0;

  if (total === 0) {
    return (
      <div className={cn("flex items-center justify-center rounded-[16px] border border-dashed border-line-strong text-[14px] text-ink-3", className)} style={{ height }}>
        No capital deposited yet
      </div>
    );
  }

  return (
    <figure className={cn("grid grid-cols-[72px_1fr] gap-x-5 md:grid-cols-[96px_1fr]", className)}>
      <div
        className="flex flex-col gap-[2px] overflow-hidden rounded-[10px]"
        style={{ height }}
        role="img"
        aria-label={`Capital stack: senior ${usd(s.nav)}, junior ${usd(j.nav)}, written down ${usd(s.writedown + j.writedown)}`}
      >
        {segments.map((seg, i) => (
          <div
            key={seg.key}
            title={`${seg.label}: ${usd(seg.value)}`}
            className={cn(seg.cls, "min-h-[3px] transition-[flex-grow] duration-700 ease-out", i === segments.length - 1 && "rounded-b-[4px]")}
            style={{ flexGrow: seg.value, flexBasis: 0 }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-[2px]" style={{ height }}>
        {segments.map((seg) => (
          <div key={seg.key} className="flex min-h-[46px] flex-col justify-center border-l border-line pl-4" style={{ flexGrow: seg.value, flexBasis: 0 }}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={cn("inline-block size-2.5 rounded-[3px]", seg.swatch)} aria-hidden />
              <span className="text-[14px] text-ink">{seg.label}</span>
              <span className="num text-[14px] text-ink">{usd(seg.value)}</span>
              <span className="num text-[12.5px] text-ink-3">{((seg.value / total) * 100).toFixed(0)}%</span>
            </div>
            <div className="pl-[18px] text-[12.5px] text-ink-3">{seg.sub}</div>
          </div>
        ))}
      </div>
      <figcaption className="col-span-2 mt-5 text-[13.5px] leading-relaxed text-ink-2">
        Senior is protected by {usd(j.nav)} of junior capital ({pct(cushion)} of the pool). Defaults hit junior first.
      </figcaption>
    </figure>
  );
}
