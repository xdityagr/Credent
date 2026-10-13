"use client";

import { ArrowDownToLine, CalendarClock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EpochStrip } from "@/components/data/epoch-strip";
import {
  Button,
  ButtonLink,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  Input,
  LoanStatusPill,
  Panel,
  PanelHeader,
  Segmented,
  toast,
  TxLink,
} from "@/components/ui";
import { errorMessage, get, post } from "@/lib/api";
import { cn } from "@/lib/cn";
import { pct, toCents, usd } from "@/lib/format";
import { type DepositPrep, type DepositStatus, type PrivateLoan, usePortalInvalidate } from "@/lib/portal";
import type { PublicPool } from "@/lib/types";
import { ConnectForSigning, useSigner } from "./signing";

// ---------------- table ----------------

export interface Column<T> {
  key: string;
  label: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function Table<T>({ rows, columns, rowKey, empty, className }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] text-[14px]">
        <thead>
          <tr className="border-b border-line text-left text-[12.5px] text-ink-3">
            {columns.map((c) => (
              <th key={c.key} className={cn("px-5 py-3 font-normal", c.align === "right" && "text-right", c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-line/60 transition-colors last:border-0 hover:bg-white/[0.02]">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-5 py-3 text-ink", c.align === "right" && "text-right num", c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- inputs ----------------

/** Dollar amount input; reports integer cents (or null when empty/invalid). */
export function MoneyInput({ value, onChange, placeholder = "0", id, max }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  max?: number | null;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">$</span>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8 num"
      />
      {max != null && (
        <button
          type="button"
          onClick={() => onChange(String(Math.floor(max / 100)))}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] text-ink-2 hover:text-ink"
        >
          Max
        </button>
      )}
    </div>
  );
}

export const cents = (v: string) => toCents(v);

// ---------------- charts ----------------

/** Compact daily revenue bars (private data; only ever rendered for its owner). */
export function RevenueBars({ daily, className, tone = "ember" }: { daily: number[]; className?: string; tone?: "ember" | "horizon" }) {
  const max = Math.max(1, ...daily);
  return (
    <div className={cn("flex h-28 items-end gap-px sm:gap-[2px]", className)} role="img" aria-label="Daily revenue, last 90 days">
      {daily.map((v, i) => (
        <div
          key={i}
          title={usd(v)}
          className={cn("min-w-0 flex-1 rounded-t-[2px]", tone === "ember" ? "bg-ember-1/80" : "bg-senior/80")}
          style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ---------------- loan summary ----------------

export function LoanSummary({ loan, compact = false }: { loan: PrivateLoan; compact?: boolean }) {
  const pctSwept = loan.owed_this_week ? Math.min(100, (loan.swept_this_week / loan.owed_this_week) * 100) : 100;
  const closed = loan.status === "REPAID" || loan.status === "DEFAULTED";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href={`/app/loans/${loan.id}`} className="font-display text-[22px] font-light text-ink hover:underline">
              {loan.id}
            </Link>
            <LoanStatusPill status={loan.status} />
          </div>
          <p className="mt-1 text-[13.5px] text-ink-2">
            {usd(loan.principal)} from {loan.pool.name} at {pct(loan.apr_bps)} over {loan.epochs} weeks
          </p>
        </div>
        <div className="text-right">
          <div className="text-[12.5px] text-ink-3">Outstanding principal</div>
          <div className="font-display text-[24px] font-light num text-ink">{usd(loan.outstanding)}</div>
        </div>
      </div>
      {!closed && (
        <div>
          <div className="flex items-baseline justify-between text-[13.5px]">
            <span className="text-ink">This week&apos;s installment</span>
            <span className="num text-ink-2">
              {usd(loan.swept_this_week)} of {usd(loan.owed_this_week)} collected
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-junior transition-[width] duration-700" style={{ width: `${pctSwept}%` }} />
          </div>
          {loan.arrears > 0 && (
            <p className="mt-2 text-[13px] text-warn">
              Includes {usd(loan.arrears)} carried from short weeks ({loan.consecutive_short} in a row; three is a default).
            </p>
          )}
        </div>
      )}
      {!compact && (
        <div>
          <div className="mb-2 text-[12.5px] text-ink-3">Weekly installments</div>
          <EpochStrip history={loan.history} epochs={loan.epochs} />
        </div>
      )}
      {loan.drawdown?.signature && (
        <div className="text-[13px] text-ink-3">
          Drawdown {loan.drawdown.status.toLowerCase()} on Solana: <TxLink signature={loan.drawdown.signature} />
        </div>
      )}
    </div>
  );
}

export function NoLoanYet() {
  return (
    <EmptyState
      tone="ember"
      icon={<CalendarClock />}
      title="No active loan"
      body="When you draw a loan, this week's installment and how much the lockbox has collected toward it appear here."
      action={<ButtonLink href="/app/pools" size="sm" variant="ember">Find a pool</ButtonLink>}
    />
  );
}

// ---------------- deposit flow ----------------

type Stage = "form" | "signing" | "confirming" | "done";

/** Deposit into a pool tranche: prepare (server builds + fee-pays) → wallet signs → submit → confirm on-chain. */
export function DepositDialog({ pool, open, onOpenChange, defaultTranche = "senior", juniorOnly = false }: {
  pool: Pick<PublicPool, "id" | "name" | "status" | "subordination_room" | "senior" | "junior">;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTranche?: "senior" | "junior";
  juniorOnly?: boolean;
}) {
  const signer = useSigner();
  const refresh = usePortalInvalidate();
  const [tranche, setTranche] = useState<"senior" | "junior">(juniorOnly ? "junior" : defaultTranche);
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DepositStatus | null>(null);
  const value = cents(amount);

  const reset = () => {
    setStage("form");
    setError(null);
    setResult(null);
    setAmount("");
  };

  async function run() {
    if (!value) return;
    setError(null);
    try {
      setStage("signing");
      const prep = await post<DepositPrep>(`/lender/pools/${pool.id}/deposits/prepare`, { tranche, amount: value });
      const signed = prep.needs_signature ? await signer.signTx(prep.tx_b64) : null;
      setStage("confirming");
      let st = await post<DepositStatus>(`/lender/deposits/${prep.intent_id}/submit`, { signed_tx_b64: signed });
      for (let i = 0; i < 20 && (st.status === "SUBMITTED" || st.status === "CREDITING"); i++) {
        await new Promise((r) => setTimeout(r, 1500));
        st = await get<DepositStatus>(`/lender/deposits/${prep.intent_id}`);
      }
      setResult(st);
      if (st.status !== "CONFIRMED") throw new Error(st.error ?? `Deposit ${st.status.toLowerCase()}.`);
      setStage("done");
      refresh();
      toast.success(`Deposited ${usd(st.amount)} into ${tranche}`, {
        action: st.explorer_url ? { label: "View tx", onClick: () => window.open(st.explorer_url!, "_blank", "noopener") } : undefined,
      });
    } catch (e) {
      setStage("form");
      setError(errorMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent
        title={`Deposit into ${pool.name}`}
        description="cUSD moves from your wallet to the pool's vault on Solana. Credent pays the network fee."
      >
        {stage === "done" && result ? (
          <div className="space-y-4">
            <p className="text-[15px] text-ink">
              {usd(result.amount)} is in the {result.tranche} tranche.
            </p>
            {result.signature && <TxLink signature={result.signature} />}
            <Button variant="white" className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!juniorOnly && (
              <Segmented
                label="Tranche"
                value={tranche}
                onChange={setTranche}
                options={[
                  { value: "senior", label: `Senior, ${pct(pool.senior.coupon_bps ?? 0)} fixed` },
                  { value: "junior", label: "Junior, first loss" },
                ]}
              />
            )}
            <Field
              label="Amount"
              hint={tranche === "senior" ? `Up to ${usd(pool.subordination_room)} fits under the leverage cap.` : "Junior absorbs losses first and earns the residual yield."}
            >
              <MoneyInput value={amount} onChange={setAmount} placeholder="50,000" />
            </Field>
            <ConnectForSigning />
            {error && <p role="alert" className="text-[13.5px] text-loss-text">{error}</p>}
            <Button
              variant="horizon"
              className="w-full"
              busy={stage !== "form"}
              disabled={!value || !signer.ready}
              icon={<ArrowDownToLine className="size-4" />}
              onClick={run}
            >
              {stage === "signing" ? (signer.custodial ? "Preparing…" : "Approve in your wallet…") : stage === "confirming" ? "Confirming on Solana…" : `Deposit ${value ? usd(value) : ""}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SectionPanel({ title, description, action, children, className }: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel className={className}>
      <PanelHeader title={title} description={description} action={action} />
      <div className="p-5 md:p-6">{children}</div>
    </Panel>
  );
}
