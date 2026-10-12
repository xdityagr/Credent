"use client";

import { useState } from "react";
import type { LoanStatus } from "@/lib/types";
import { short } from "@/lib/format";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ink" | "quiet" | "loss" | "junior";
  busy?: boolean;
};

export function Button({ variant = "ink", busy, className = "", children, disabled, ...rest }: ButtonProps) {
  const styles = {
    ink: "bg-ink text-sheet hover:bg-[#2a3d5f]",
    junior: "bg-junior text-sheet hover:bg-[#245744]",
    loss: "bg-loss text-sheet hover:bg-[#952016]",
    quiet: "bg-transparent text-ink border border-rule-strong hover:bg-paper-deep",
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-[4px] px-4 py-2.5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function Notice({ kind = "error", children }: { kind?: "error" | "info" | "ok"; children: React.ReactNode }) {
  const styles = {
    error: "border-loss/40 bg-loss-soft text-loss",
    info: "border-rule-strong bg-paper-deep text-ink-soft",
    ok: "border-junior/40 bg-junior-soft text-junior",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-[4px] border px-4 py-3 text-[15px] ${styles}`}>
      {children}
    </div>
  );
}

export function Hash({ value, head = 6, tail = 4, full = false }: { value: string; head?: number; tail?: number; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={copied ? "Copied" : `Copy ${value}`}
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className={`font-mono text-[13px] text-ink-soft hover:text-ink ${full ? "break-all text-left" : ""}`}
    >
      {full ? value : short(value, head, tail)}
      {copied && <span className="ml-1.5 font-sans text-xs text-junior">copied</span>}
    </button>
  );
}

const STATUS: Record<LoanStatus, string> = {
  ACTIVE: "text-junior border-junior/40 bg-junior-soft",
  LATE: "text-warn border-warn/40 bg-warn-soft",
  DEFAULTED: "text-loss border-loss/40 bg-loss-soft",
  REPAID: "text-ink-soft border-rule-strong bg-paper-deep",
};

export function StatusTag({ status }: { status: LoanStatus }) {
  return (
    <span className={`inline-block rounded-[3px] border px-2 py-0.5 text-[13px] font-semibold ${STATUS[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-[4px] border border-rule-strong bg-sheet px-3 py-2.5 text-[16px] text-ink tabular-nums placeholder:text-ink-faint focus:border-envelope focus:outline-none";

export function Sheet({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-[6px] border border-rule bg-sheet ${className}`}>{children}</section>;
}

export function Figure({
  label,
  value,
  tone = "ink",
  sub,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "ink" | "junior" | "loss" | "warn";
  sub?: React.ReactNode;
}) {
  const color = { ink: "text-ink", junior: "text-junior", loss: "text-loss", warn: "text-warn" }[tone];
  return (
    <div>
      <div className="text-[13px] text-ink-faint">{label}</div>
      <div className={`mt-0.5 text-[22px] font-semibold tabular-nums leading-tight ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[13px] text-ink-faint">{sub}</div>}
    </div>
  );
}
