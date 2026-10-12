"use client";

import { ArrowUpRight, FileCheck2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RoleGate } from "@/components/app/kit";
import { MoneyInput, SectionPanel, Table, cents } from "@/components/app/portal";
import { Button, ButtonLink, EmptyState, Field, PageHeader, Select, Skeleton, StatusPill, toast } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { date, usd } from "@/lib/format";
import { type ProofView, useBorrowerActions, useProofs, useSources } from "@/lib/portal";

function Prove() {
  const params = useSearchParams();
  const sources = useSources();
  const a = useBorrowerActions();
  const [sourceId, setSourceId] = useState<string | null>(params.get("source"));
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<ProofView | null>(null);

  const list = sources.data ?? [];
  const current = list.find((s) => s.id === sourceId) ?? list[0];
  const suggested = current?.series?.suggested_threshold ?? 0;
  const threshold = cents(amount) ?? suggested;

  if (sources.isPending) return <Skeleton className="h-56 w-full rounded-[20px]" />;
  if (list.length === 0)
    return (
      <EmptyState
        tone="ember"
        icon={<FileCheck2 />}
        title="Connect revenue first"
        body="A proof is built from a revenue source's last 90 days."
        action={<ButtonLink href="/app/revenue" size="sm" variant="ember">Connect a source</ButtonLink>}
      />
    );

  async function run() {
    if (!current) return;
    setError(null);
    try {
      const p = await a.prove.mutateAsync({ source_id: current.id, threshold });
      setLast(p);
      toast.success("Proof verified", { description: `Revenue of at least ${usd(p.threshold)} proven in zero knowledge.` });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const over = current?.series && threshold > current.series.total;
  return (
    <SectionPanel
      title="Generate a proof"
      description="A Noir circuit proves the sum of your 90 daily revenues is at least the threshold. Only the threshold and a commitment become public."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Revenue source">
          <Select value={current?.id} onChange={(e) => setSourceId(e.target.value)}>
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.kind_label})
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Prove revenue of at least"
          hint={over ? "Higher than your actual revenue: no valid proof can exist." : `Suggested: ${usd(suggested)}. This number becomes public.`}
        >
          <MoneyInput value={amount} onChange={setAmount} placeholder={String(Math.floor(suggested / 100))} />
        </Field>
      </div>
      <pre className="mt-5 overflow-x-auto rounded-[16px] border border-line bg-black/60 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink-2">
{`// circuits/revenue_proof  (Noir · UltraHonk)
assert(sum(daily[0..90]) >= ${threshold});   // public, in cents
return pedersen_hash(daily ++ [salt]);   // equals the notarised commitment`}
      </pre>
      {error && <p role="alert" className="mt-4 text-[13.5px] text-loss-text">{error}</p>}
      {last && (
        <div className="mt-4 rounded-[16px] border border-junior/30 bg-junior/[0.06] p-4 text-[13.5px] text-ink">
          <ShieldCheck className="mr-1.5 inline size-4 text-junior-text" />
          Proof {last.id} verified
          {Object.keys(last.timings_ms).length > 0 && (
            <span className="text-ink-2"> ({Object.entries(last.timings_ms).map(([k, v]) => `${k} ${v} ms`).join(", ")})</span>
          )}
          .{" "}
          <Link href="/app/pools" className="text-ember-1 underline">Apply to a pool with it</Link>
        </div>
      )}
      <Button variant="ember" className="mt-5" busy={a.prove.isPending} disabled={!threshold || Boolean(over)} onClick={run}>
        {a.prove.isPending ? "Proving…" : `Prove ≥ ${usd(threshold)}`}
      </Button>
    </SectionPanel>
  );
}

function ProofList() {
  const q = useProofs();
  if (q.isPending) return <Skeleton className="h-40 w-full rounded-[20px]" />;
  return (
    <SectionPanel title="Your proofs" description="Proofs stay valid for 30 days. Anyone can re-verify them from the public page.">
      <Table
        rows={q.data ?? []}
        rowKey={(p) => p.id}
        empty={<p className="text-[14px] text-ink-3">No proofs yet.</p>}
        columns={[
          { key: "id", label: "Proof", render: (p) => <span className="font-mono text-[13px]">{p.id}</span> },
          { key: "t", label: "Proven revenue", align: "right", render: (p) => <>≥ {usd(p.threshold)}</> },
          { key: "src", label: "Source", render: (p) => p.source?.label ?? "—" },
          { key: "d", label: "Created", render: (p) => date(p.date) },
          {
            key: "s",
            label: "Status",
            render: (p) => (p.expired ? <StatusPill tone="neutral">Expired</StatusPill> : <StatusPill tone="good">Valid until {date(p.expires_date)}</StatusPill>),
          },
          {
            key: "v",
            label: "",
            align: "right",
            render: (p) => (
              <Link href={`/proofs/${p.id}`} className="inline-flex items-center gap-1 text-[13px] text-horizon-2 hover:text-white">
                Public page <ArrowUpRight className="size-3" />
              </Link>
            ),
          },
        ]}
      />
    </SectionPanel>
  );
}

export default function ProofsPage() {
  return (
    <RoleGate kind="BORROWER">
      <div className="space-y-8">
        <PageHeader title="Proofs" description="Prove your revenue clears a threshold without showing the figures." />
        <Suspense fallback={<Skeleton className="h-56 w-full rounded-[20px]" />}>
          <Prove />
        </Suspense>
        <ProofList />
      </div>
    </RoleGate>
  );
}
