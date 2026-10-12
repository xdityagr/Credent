"use client";

import { ArrowUpRight, Send, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RoleGate } from "@/components/app/kit";
import { MoneyInput, cents } from "@/components/app/portal";
import { ReservesBadge, TrancheBar } from "@/components/data/pool-card";
import {
  Badge,
  Button,
  ButtonLink,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  PageHeader,
  Panel,
  PoolStatusPill,
  Select,
  Skeleton,
  Stat,
  toast,
} from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { pct, usd } from "@/lib/format";
import { type ProofView, useBorrowerActions, useProofs } from "@/lib/portal";
import { usePools } from "@/lib/queries";
import type { PublicPool } from "@/lib/types";

const limitFor = (p: PublicPool, threshold: number) => {
  const cap = Math.floor((threshold * p.advance_bps) / 10_000);
  return p.max_loan ? Math.min(cap, p.max_loan) : cap;
};

/** Level weekly installment, same formula as the backend's amortization. */
function installment(amount: number, aprBps: number, epochs: number) {
  const r = ((aprBps / 10_000) * 7) / 365;
  return r === 0 ? Math.round(amount / epochs) : Math.round((amount * r) / (1 - (1 + r) ** -epochs));
}

function ApplyDialog({ pool, proofs, onClose }: { pool: PublicPool; proofs: ProofView[]; onClose: () => void }) {
  const a = useBorrowerActions();
  const router = useRouter();
  const eligible = proofs.filter((p) => !p.expired && p.threshold >= pool.min_threshold);
  const [proofId, setProofId] = useState(eligible[0]?.id ?? "");
  const proof = eligible.find((p) => p.id === proofId);
  const max = proof ? Math.floor(Math.min(limitFor(pool, proof.threshold), pool.cash) / 1_000_00) * 1_000_00 : 0;
  const [amount, setAmount] = useState(max ? String(max / 100) : "");
  const [error, setError] = useState<string | null>(null);
  const value = cents(amount);
  const inst = value ? installment(value, pool.borrower_apr_bps, pool.term_epochs) : 0;

  async function submit() {
    if (!proof || !value) return;
    setError(null);
    try {
      const app = await a.apply.mutateAsync({ pool_id: pool.id, proof_id: proof.id, amount: value });
      toast.success(app.status === "APPROVED" ? "Approved. Sign the terms to draw." : "Application sent", {
        description: app.status === "APPROVED" ? "This pool auto-approves proofs like yours." : `${pool.manager.name} will review it.`,
      });
      onClose();
      router.push(`/app/applications?open=${app.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={`Apply to ${pool.name}`} description={`Managed by ${pool.manager.name}. They'll see your company profile and proven threshold, never your revenue.`} className="max-w-[520px]">
        {eligible.length === 0 ? (
          <EmptyState
            title="No eligible proof"
            body={`This pool needs proven 90-day revenue of at least ${usd(pool.min_threshold)}. Generate a proof at or above that.`}
            action={<ButtonLink href="/app/proofs" size="sm" variant="ember">Generate a proof</ButtonLink>}
          />
        ) : (
          <div className="space-y-4">
            <Field label="Proof">
              <Select value={proofId} onChange={(e) => setProofId(e.target.value)}>
                {eligible.map((p) => (
                  <option key={p.id} value={p.id}>
                    ≥ {usd(p.threshold)} proven ({p.id})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount" hint={`Up to ${usd(max)}: ${pct(pool.advance_bps, 0)} of your proven revenue${pool.max_loan ? `, capped at ${usd(pool.max_loan)}` : ""}, within the ${usd(pool.cash)} the pool has available.`}>
              <MoneyInput value={amount} onChange={setAmount} max={max} />
            </Field>
            {value ? (
              <div className="grid grid-cols-3 gap-3 rounded-[16px] border border-line bg-white/[0.02] p-4">
                <Stat label="Weekly installment" value={<span className="num">{usd(inst)}</span>} />
                <Stat label="Term" value={`${pool.term_epochs} weeks`} />
                <Stat label="Total interest" value={<span className="num">{usd(inst * pool.term_epochs - value)}</span>} />
              </div>
            ) : null}
            <p className="text-[12.5px] leading-relaxed text-ink-3">
              Repayment comes out of your incoming customer payments: each week&apos;s installment is collected first, the rest is yours.
            </p>
            {error && <p role="alert" className="text-[13.5px] text-loss-text">{error}</p>}
            <Button variant="ember" className="w-full" icon={<Send className="size-4" />} busy={a.apply.isPending} disabled={!value || value > max} onClick={submit}>
              Submit application
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PoolRow({ pool, best, onApply }: { pool: PublicPool; best: ProofView | undefined; onApply: () => void }) {
  const eligible = best ? best.threshold >= pool.min_threshold : false;
  const max = best && eligible ? Math.min(limitFor(pool, best.threshold), pool.cash) : 0;
  return (
    <Panel className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/pools/${pool.slug}`} className="text-[17px] text-ink hover:underline">{pool.name}</Link>
            <PoolStatusPill status={pool.status} />
            {pool.auto_approve && <Badge>Auto-approve</Badge>}
          </div>
          <p className="mt-1 text-[13.5px] text-ink-2">by {pool.manager.name}</p>
        </div>
        <ReservesBadge reserves={pool.reserves} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Borrower APR" value={pct(pool.borrower_apr_bps)} />
        <Stat label="Advance" value={`${pct(pool.advance_bps, 0)} of revenue`} />
        <Stat label="Term" value={`${pool.term_epochs} weeks`} />
        <Stat label="Min. proven revenue" value={<span className="num">{usd(pool.min_threshold)}</span>} />
      </div>
      <TrancheBar senior={pool.senior.nav} junior={pool.junior.nav} className="mt-5" />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[13.5px] text-ink-2">
          {!best ? "Generate a proof to see what you can borrow here." : eligible ? <>Your proof supports up to <span className="num text-ink">{usd(max)}</span>.</> : `Your best proof (${usd(best.threshold)}) is below this pool's minimum.`}
        </p>
        <div className="flex gap-2">
          <ButtonLink href={`/pools/${pool.slug}`} size="sm" variant="ghost" iconRight={<ArrowUpRight className="size-3.5" />}>Details</ButtonLink>
          <Button size="sm" variant="ember" disabled={pool.status !== "OPEN"} onClick={onApply}>Apply</Button>
        </div>
      </div>
    </Panel>
  );
}

export default function BorrowerPoolsPage() {
  const pools = usePools();
  const proofs = useProofs();
  const [applying, setApplying] = useState<PublicPool | null>(null);
  const valid = useMemo(() => (proofs.data ?? []).filter((p) => !p.expired).sort((a, b) => b.threshold - a.threshold), [proofs.data]);
  const open = (pools.data ?? []).filter((p) => p.status === "OPEN");
  return (
    <RoleGate kind="BORROWER">
      <div className="space-y-8">
        <PageHeader title="Pools" description="Lender-run pools taking applications. Compare terms and apply with a proof." />
        {pools.isPending ? (
          <div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-64 rounded-[20px]" /><Skeleton className="h-64 rounded-[20px]" /></div>
        ) : open.length === 0 ? (
          <EmptyState tone="ember" icon={<Store />} title="No pools are open right now" body="Pools appear here once a lender funds the first-loss tranche and opens for applications." />
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {open.map((p) => <PoolRow key={p.id} pool={p} best={valid[0]} onApply={() => setApplying(p)} />)}
          </div>
        )}
        {applying && <ApplyDialog pool={applying} proofs={valid} onClose={() => setApplying(null)} />}
      </div>
    </RoleGate>
  );
}
