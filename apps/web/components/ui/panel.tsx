import { cn } from "@/lib/cn";

/** Raised surface for app content. */
export function Panel({
  children,
  className,
  as: Tag = "section",
  ...rest
}: { children: React.ReactNode; className?: string; as?: "section" | "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("panel rounded-[20px]", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-5 md:px-6 md:pt-6", className)}>
      <div className="min-w-0">
        <h2 className="text-[16px] font-medium text-ink">{title}</h2>
        {description && <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Label / value pair in a definition grid. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="num mt-1 truncate text-[17px] text-ink">{value}</dd>
      {hint && <dd className="mt-0.5 text-[12px] text-ink-3">{hint}</dd>}
    </div>
  );
}

/** Page title block for the app and site sub-pages. */
export function PageHeader({
  title,
  description,
  actions,
  className,
  kicker,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  kicker?: React.ReactNode;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="min-w-0 max-w-[60ch]">
        {kicker && <div className="mb-3">{kicker}</div>}
        <h1 className="font-display text-[26px] font-light leading-[1.15] tracking-[-0.03em] text-ink md:text-[30px]">{title}</h1>
        {description && <p className="mt-2.5 text-[15px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Small rounded label (not ALL-CAPS). */
export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border border-line-strong bg-white/[0.04] px-3 text-[12.5px] text-ink-2", className)}>
      {children}
    </span>
  );
}
