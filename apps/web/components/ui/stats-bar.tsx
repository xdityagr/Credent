import { cn } from "@/lib/cn";

/** StatsGlassBar: a row of headline figures on a glass strip (Financy). */
export function StatsGlassBar({
  items,
  className,
  footer,
}: {
  items: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode }[];
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className={cn("glass edge rounded-[28px] px-2 py-2", className)}>
      <dl className="grid grid-cols-2 md:grid-cols-4">
        {items.map((it, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-2 px-5 py-5 md:px-7 md:py-6",
              i % 2 === 1 && "border-l border-line",
              i >= 2 && "border-t border-line md:border-t-0",
              i === 2 && "md:border-l",
            )}
          >
            <dt className="order-2 text-[13px] text-ink-2">{it.label}</dt>
            <dd className="order-1 font-display text-[clamp(22px,2.6vw,34px)] font-extralight leading-none tracking-[-0.02em] text-ink">
              {it.value}
            </dd>
            {it.hint && <dd className="order-3 text-[12px] text-ink-3">{it.hint}</dd>}
          </div>
        ))}
      </dl>
      {footer && <div className="border-t border-line px-5 py-3 text-[12.5px] text-ink-3 md:px-7">{footer}</div>}
    </div>
  );
}
