import { AlertTriangle, CheckCircle2, CircleDot, Clock, Lock, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type StatusTone = "neutral" | "public" | "good" | "warn" | "loss" | "private" | "pending";

const toneCls: Record<StatusTone, string> = {
  neutral: "border-line-strong bg-white/[0.04] text-ink-2",
  public: "border-senior/40 bg-senior/10 text-senior-text",
  good: "border-junior/40 bg-junior/10 text-junior-text",
  warn: "border-warn/35 bg-warn/10 text-warn",
  loss: "border-loss/45 bg-loss/10 text-loss-text",
  private: "border-ember-1/35 bg-ember-1/10 text-ember-1",
  pending: "border-line-strong bg-white/[0.03] text-ink-2",
};

const toneIcon: Record<StatusTone, React.ComponentType<{ className?: string }>> = {
  neutral: CircleDot,
  public: CircleDot,
  good: CheckCircle2,
  warn: AlertTriangle,
  loss: XCircle,
  private: Lock,
  pending: Clock,
};

/** Status is never colour alone: every pill carries an icon and a word. */
export function StatusPill({
  tone = "neutral",
  children,
  className,
  icon = true,
  live = false,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
  icon?: boolean;
  live?: boolean;
}) {
  const Icon = toneIcon[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium",
        toneCls[tone],
        className,
      )}
    >
      {live ? (
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 animate-pulse-dot rounded-full bg-current" />
        </span>
      ) : (
        icon && <Icon className="size-3.5" aria-hidden />
      )}
      {children}
    </span>
  );
}

const loanTone: Record<string, StatusTone> = {
  ACTIVE: "public",
  LATE: "warn",
  DEFAULTED: "loss",
  REPAID: "good",
};

export function LoanStatusPill({ status }: { status: string }) {
  return <StatusPill tone={loanTone[status] ?? "neutral"}>{status.charAt(0) + status.slice(1).toLowerCase()}</StatusPill>;
}

const poolTone: Record<string, StatusTone> = {
  DRAFT: "pending",
  FUNDING: "warn",
  OPEN: "good",
  CLOSED: "neutral",
};

export function PoolStatusPill({ status }: { status: string }) {
  const label = status === "OPEN" ? "Open for applications" : status === "FUNDING" ? "Raising capital" : status.charAt(0) + status.slice(1).toLowerCase();
  return <StatusPill tone={poolTone[status] ?? "neutral"}>{label}</StatusPill>;
}
