"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RoleGate } from "@/components/app/kit";
import { MoneyInput, SectionPanel, cents } from "@/components/app/portal";
import { CapitalStack } from "@/components/data/capital-stack";
import { Button, Field, Input, PageHeader, Panel, Stat, Textarea, toast } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { pct, usd } from "@/lib/format";
import { useLenderActions } from "@/lib/portal";

function Slider({ label, value, onChange, min, max, step, format, hint }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[13.5px]">
        <span className="text-ink">{label}</span>
        <span className="num text-ink">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#8fb4ff]"
      />
      {hint && <span className="mt-1 block text-[12.5px] text-ink-3">{hint}</span>}
    </label>
  );
}

export default function NewPoolPage() {
  const router = useRouter();
  const a = useLenderActions();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("1000000");
  const [coupon, setCoupon] = useState(900);
  const [leverage, setLeverage] = useState(400);
  const [apr, setApr] = useState(1800);
  const [advance, setAdvance] = useState(4000);
  const [term, setTerm] = useState(12);
  const [minRevenue, setMinRevenue] = useState("250000");
  const [maxLoan, setMaxLoan] = useState("");
  const [firstLoss, setFirstLoss] = useState("200000");
  const [auto, setAuto] = useState(false);
  const [autoMax, setAutoMax] = useState("100000");
  const [error, setError] = useState<string | null>(null);

  const targetC = cents(target) ?? 0;
  const firstLossC = cents(firstLoss) ?? 0;
  const seniorMax = Math.min(Math.max(targetC - firstLossC, 0), Math.floor((firstLossC * leverage) / 100));
  const blended = targetC ? Math.round(((seniorMax * coupon) / (seniorMax + firstLossC || 1))) : 0;

  async function create() {
    setError(null);
    try {
      const pool = await a.create.mutateAsync({
        name,
        description,
        target_size: targetC,
        senior_coupon_bps: coupon,
        max_leverage_x100: leverage,
        borrower_apr_bps: apr,
        advance_bps: advance,
        term_epochs: term,
        min_threshold: cents(minRevenue) ?? 0,
        max_loan: cents(maxLoan) ?? 0,
        min_first_loss: firstLossC,
        auto_approve: auto,
        auto_approve_max: auto ? cents(autoMax) ?? 0 : 0,
      });
      toast.success("Pool created as a draft", { description: "Review it, then start funding." });
      router.push(`/app/my-pools/${pool.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <RoleGate kind="LENDER">
      <div className="space-y-8">
        <Link href="/app/my-pools" className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-3 hover:text-ink">
          <ArrowLeft className="size-3.5" /> My pools
        </Link>
        <PageHeader title="Create a pool" description="Your terms are published on the ledger when funding starts and can't change after that." />
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <SectionPanel title="Basics">
              <div className="space-y-4">
                <Field label="Pool name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Harbor Revenue Fund II" /></Field>
                <Field label="Description" optional><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who this pool lends to and why." /></Field>
                <Field label="Target size"><MoneyInput value={target} onChange={setTarget} /></Field>
              </div>
            </SectionPanel>
            <SectionPanel title="Lender side" description="What senior investors are promised and how much first-loss capital protects them.">
              <div className="space-y-5">
                <Slider label="Senior coupon" value={coupon} onChange={setCoupon} min={200} max={2000} step={25} format={(v) => pct(v, 2)} hint="Paid to senior before junior earns anything." />
                <Slider label="Max leverage" value={leverage} onChange={setLeverage} min={100} max={800} step={25} format={(v) => `${(v / 100).toFixed(2)}x`} hint="Senior can be at most this multiple of junior." />
                <Field label="Your first-loss commitment" hint="You fund the junior tranche before the pool opens.">
                  <MoneyInput value={firstLoss} onChange={setFirstLoss} />
                </Field>
              </div>
            </SectionPanel>
            <SectionPanel title="Borrower side" description="What borrowers pay and how much their proven revenue unlocks.">
              <div className="space-y-5">
                <Slider label="Borrower APR" value={apr} onChange={setApr} min={500} max={4000} step={50} format={(v) => pct(v)} />
                <Slider label="Advance rate" value={advance} onChange={setAdvance} min={1000} max={6000} step={250} format={(v) => `${pct(v, 0)} of 90-day revenue`} />
                <Slider label="Term" value={term} onChange={setTerm} min={4} max={52} step={1} format={(v) => `${v} weeks`} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Minimum proven revenue (90 days)"><MoneyInput value={minRevenue} onChange={setMinRevenue} /></Field>
                  <Field label="Maximum loan" optional hint="Blank means only the advance rate limits it."><MoneyInput value={maxLoan} onChange={setMaxLoan} placeholder="No cap" /></Field>
                </div>
                <label className="flex items-start gap-3 rounded-[16px] border border-line p-4">
                  <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-1 accent-[#8fb4ff]" />
                  <span className="flex-1">
                    <span className="block text-[14px] text-ink">Approve automatically</span>
                    <span className="block text-[12.5px] text-ink-3">Applications with a valid proof that meets your minimum are approved instantly, up to a limit.</span>
                    {auto && <span className="mt-3 block"><MoneyInput value={autoMax} onChange={setAutoMax} /></span>}
                  </span>
                </label>
              </div>
            </SectionPanel>
          </div>
          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <Panel className="p-5 md:p-6">
              <h2 className="text-[16px] text-ink">Capital stack at target</h2>
              <p className="mt-1 text-[13px] text-ink-3">How the pool looks fully funded under your leverage cap.</p>
              <CapitalStack
                className="mt-5"
                height={240}
                pool={{ senior: { nav: seniorMax, writedown: 0, coupon_bps: coupon }, junior: { nav: firstLossC, writedown: 0 } }}
              />
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
                <Stat label="Borrower APR" value={pct(apr)} />
                <Stat label="Blended cost of capital" value={pct(blended)} />
                <Stat label="Spread to junior" value={pct(Math.max(0, apr - coupon))} />
                <Stat label="Senior capacity" value={<span className="num">{usd(seniorMax)}</span>} />
              </div>
            </Panel>
            {error && <p role="alert" className="text-[13.5px] text-loss-text">{error}</p>}
            <Button variant="horizon" className="w-full" busy={a.create.isPending} disabled={!name || !targetC} onClick={create}>
              Create draft pool
            </Button>
          </div>
        </div>
      </div>
    </RoleGate>
  );
}
