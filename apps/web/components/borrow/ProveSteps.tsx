"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { sourceName } from "@/lib/events";
import { toCents, usd } from "@/lib/format";
import type { BorrowerView, ProveResult } from "@/lib/types";
import { Envelope } from "../Envelope";
import { RevenueChart } from "../RevenueChart";
import { Button, Field, Hash, Notice, inputCls } from "../ui";

const ADVANCE = 0.4;

export function RevenueEnvelope({ view }: { view: BorrowerView }) {
  const s = view.series!;
  return (
    <Envelope
      owner
      defaultOpen
      label={`Revenue, days ${s.period_start} to ${s.period_end - 1}`}
      publicNote="Sealed. Lenders only ever see the commitment and the proven threshold."
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-[28px] font-bold tabular-nums tracking-[-0.02em] text-ink">{usd(s.total)}</span>
        <span className="text-[14px] text-ink-soft">90-day revenue from {sourceName(s.source)}</span>
      </div>
      <RevenueChart daily={s.daily} start={s.period_start} />
    </Envelope>
  );
}

export function NotarizeStep({ token, onDone }: { token: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="max-w-[40rem] text-[16px] leading-relaxed text-ink-soft">
        The notary hashes your 90 daily figures with a random salt into a Pedersen commitment and signs only
        that commitment. The figures stay in your envelope.
      </p>
      {error && <Notice>{error}</Notice>}
      <Button
        busy={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api("/borrower/attest", { method: "POST", token });
            onDone();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Notarize revenue
      </Button>
    </div>
  );
}

export function ProveStep({ token, view, onDone }: { token: string; view: BorrowerView; onDone: () => void }) {
  const s = view.series!;
  const [amount, setAmount] = useState(String(s.suggested_threshold / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProveResult | null>(null);
  const cents = toCents(amount);

  async function prove() {
    if (!cents) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<ProveResult>("/borrower/prove", { body: { threshold: cents }, token });
      setResult(r);
      await api("/borrower/credit-line", { method: "POST", token });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[4px] border border-rule bg-paper px-4 py-3 text-[14px] text-ink-soft">
        Commitment signed by the notary: <Hash value={view.attestation!.commitment} head={10} tail={6} />
      </div>
      <div className="grid max-w-[40rem] gap-5 sm:grid-cols-2">
        <Field
          label="Prove revenue of at least"
          hint={cents && cents > s.total ? "Higher than your actual revenue: no valid proof can exist." : "This number becomes public."}
        >
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={inputCls} />
        </Field>
        <div className="pt-7 text-[15px] text-ink-soft">
          Credit line: <span className="font-semibold text-ink">{cents ? usd(Math.floor(cents * ADVANCE)) : "–"}</span>
          <span className="block text-[13px] text-ink-faint">40% of the proven threshold</span>
        </div>
      </div>
      <pre className="max-w-[40rem] overflow-x-auto rounded-[4px] bg-ink px-4 py-3 font-mono text-[13px] leading-relaxed text-sheet/90">
{`// circuits/revenue_proof (Noir, UltraHonk)
assert(sum(daily[0..90]) >= ${cents ?? "threshold"});   // public, in cents
return pedersen_hash(daily ++ [salt]);   // must equal the notarized commitment`}
      </pre>
      {error && <Notice>{error}</Notice>}
      {result && (
        <Notice kind="ok">
          Proof verified in{" "}
          {Object.entries(result.timings_ms)
            .map(([k, v]) => `${k} ${v} ms`)
            .join(", ")}
          .
        </Notice>
      )}
      <Button busy={busy} disabled={!cents} onClick={prove}>
        {busy ? "Proving" : "Generate proof and open credit line"}
      </Button>
    </div>
  );
}

export function DrawStep({ token, view, onDone }: { token: string; view: BorrowerView; onDone: () => void }) {
  const limit = view.credit_line!.limit;
  const [amount, setAmount] = useState(String(limit / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = toCents(amount);
  return (
    <div className="space-y-5">
      <div className="grid max-w-[40rem] gap-5 sm:grid-cols-2">
        <Field label="Draw amount" hint={`Up to ${usd(limit)}. 18% APR, 12 weekly installments.`}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={inputCls} />
        </Field>
        <div className="pt-7 text-[15px] text-ink-soft">
          Weekly installment about{" "}
          <span className="font-semibold text-ink">{cents ? usd(installment(cents)) : "–"}</span>
          <span className="block text-[13px] text-ink-faint">swept from incoming payments before you receive them</span>
        </div>
      </div>
      {error && <Notice>{error}</Notice>}
      <Button
        busy={busy}
        disabled={!cents}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api("/borrower/draw", { body: { amount: cents }, token });
            onDone();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Draw {cents ? usd(cents) : ""}
      </Button>
    </div>
  );
}

function installment(cents: number): number {
  const r = (0.18 * 7) / 365;
  return Math.round((cents * r) / (1 - (1 + r) ** -12));
}
