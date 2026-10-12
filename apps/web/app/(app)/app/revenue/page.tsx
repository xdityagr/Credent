"use client";

import { Download, FileUp, LineChart, Plug, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { RevenueBars, SectionPanel } from "@/components/app/portal";
import { RoleGate } from "@/components/app/kit";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  Input,
  PageHeader,
  QueryView,
  Segmented,
  Skeleton,
  StatusPill,
  toast,
} from "@/components/ui";
import { errorMessage, get } from "@/lib/api";
import { date, usd } from "@/lib/format";
import { type RevenueSource, useBorrowerActions, useSources } from "@/lib/portal";

const PROFILES = [
  { key: "saas", label: "Subscription software", body: "Steady B2B SaaS revenue with mild growth." },
  { key: "ecommerce", label: "Seasonal e-commerce", body: "Direct-to-consumer sales with weekly and seasonal swings." },
  { key: "distressed", label: "Concentrated freight broker", body: "Healthy until its anchor client leaves, three weeks after funding." },
];

type Method = "demo" | "stripe" | "receipts";

function ConnectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const a = useBorrowerActions();
  const [method, setMethod] = useState<Method>("demo");
  const [profile, setProfile] = useState("saas");
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("Signed receipts");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = a.connectDemo.isPending || a.connectStripe.isPending || a.connectReceipts.isPending;

  async function sample(tampered: boolean) {
    try {
      const rows = await get<unknown[]>(`/borrower/sample-receipts?profile=${profile}&tampered=${tampered}`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 1)], { type: "application/json" }));
      const el = document.createElement("a");
      el.href = url;
      el.download = `receipts-${profile}${tampered ? "-tampered" : ""}.json`;
      el.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function connect() {
    setError(null);
    try {
      if (method === "demo") await a.connectDemo.mutateAsync(profile);
      if (method === "stripe") await a.connectStripe.mutateAsync(key);
      if (method === "receipts") {
        if (!file) throw new Error("Choose a receipts file.");
        await a.connectReceipts.mutateAsync({ file, label });
      }
      toast.success("Revenue source connected", { description: "Your last 90 days are ready to prove." });
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Connect a revenue source"
        description="Credent reads 90 days of revenue privately. Lenders never see these figures, only a threshold you choose to prove."
        className="max-w-[560px]"
      >
        <div className="space-y-5">
          <Segmented
            label="Source"
            value={method}
            onChange={(v) => { setMethod(v); setError(null); }}
            options={[
              { value: "demo", label: "Demo business" },
              { value: "stripe", label: "Stripe test mode" },
              { value: "receipts", label: "Signed receipts" },
            ]}
          />
          {method === "demo" && (
            <div className="grid gap-2">
              {PROFILES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={profile === p.key}
                  onClick={() => setProfile(p.key)}
                  className={`rounded-[16px] border p-4 text-left transition ${profile === p.key ? "border-ember-1/60 bg-ember-1/[0.06]" : "border-line hover:border-line-strong"}`}
                >
                  <span className="block text-[14.5px] text-ink">{p.label}</span>
                  <span className="block text-[13px] text-ink-3">{p.body}</span>
                </button>
              ))}
              <p className="text-[12.5px] text-ink-3">A simulated business: its customer payments keep arriving in your lockbox as the clock runs.</p>
            </div>
          )}
          {method === "stripe" && (
            <Field
              label="Restricted test key"
              hint={<>Create one in Stripe → Developers → API keys with read access to Charges. Only <code>rk_test_</code> or <code>sk_test_</code> keys are accepted; it&apos;s encrypted at rest.</>}
            >
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="rk_test_..." autoComplete="off" spellCheck={false} />
            </Field>
          )}
          {method === "receipts" && (
            <div className="space-y-3">
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                Each receipt carries your payment processor&apos;s signature. Edited receipts fail verification.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" icon={<Download className="size-3.5" />} onClick={() => sample(false)}>Sample receipts</Button>
                <Button size="sm" variant="ghost" icon={<Download className="size-3.5" />} onClick={() => sample(true)}>Tampered copy</Button>
              </div>
              <input ref={fileRef} type="file" accept=".json,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-[16px] border border-dashed border-line-strong p-4 text-left text-[14px] text-ink-2 hover:border-ink-3"
              >
                <FileUp className="size-4" /> {file ? file.name : "Choose a .json or .csv file"}
              </button>
              <Field label="Label"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
            </div>
          )}
          {error && <p role="alert" className="text-[13.5px] text-loss-text">{error}</p>}
          <Button
            variant="ember"
            className="w-full"
            busy={busy}
            disabled={(method === "stripe" && !key) || (method === "receipts" && !file)}
            onClick={connect}
          >
            {method === "stripe" ? "Connect Stripe" : method === "receipts" ? "Verify receipts" : "Connect demo business"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SourceCard({ src }: { src: RevenueSource }) {
  const a = useBorrowerActions();
  const s = src.series;
  return (
    <SectionPanel
      title={
        <span className="flex items-center gap-2">
          {src.label}
          <Badge>{src.kind_label}</Badge>
        </span>
      }
      description={`Connected ${date(src.connected_at)}${src.last_polled_at ? `, last synced ${date(src.last_polled_at)}` : ""}`}
      action={
        <div className="flex items-center gap-2">
          <StatusPill tone="private">Private</StatusPill>
          <button
            type="button"
            aria-label="Disconnect"
            onClick={() => a.disconnect.mutate(src.id, { onSuccess: () => toast.success("Source disconnected") })}
            className="inline-flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-white/5 hover:text-loss-text"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      }
    >
      {s ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[12.5px] text-ink-3">Last 90 days</div>
              <div className="font-display text-[28px] font-light num text-ink">{usd(s.total)}</div>
            </div>
            <div className="text-right text-[13px] text-ink-2">
              You could prove at least <span className="num text-ink">{usd(s.suggested_threshold)}</span>
            </div>
          </div>
          <RevenueBars daily={s.daily} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-[13px] text-ink-3">
              {src.attestation ? <>Notarised commitment <span className="font-mono">{src.attestation.commitment.slice(0, 12)}…</span></> : "Not notarised yet. Proving notarises it first."}
            </p>
            <Link href={`/app/proofs?source=${src.id}`} className="inline-flex items-center gap-1.5 text-[13.5px] text-ember-1 hover:underline">
              <Sparkles className="size-3.5" /> Prove revenue
            </Link>
          </div>
        </div>
      ) : (
        <p className="text-[14px] text-ink-3">No history yet.</p>
      )}
    </SectionPanel>
  );
}

export default function RevenuePage() {
  const q = useSources();
  const [open, setOpen] = useState(false);
  return (
    <RoleGate kind="BORROWER">
      <div className="space-y-8">
        <PageHeader
          title="Revenue"
          description="Connect where your revenue comes from. Only a threshold you choose ever leaves this page."
          actions={<Button variant="ember" icon={<Plug className="size-4" />} onClick={() => setOpen(true)}>Connect a source</Button>}
        />
        <QueryView
          query={q}
          loading={<Skeleton className="h-64 w-full rounded-[20px]" />}
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState
              tone="ember"
              icon={<LineChart />}
              title="No revenue source connected"
              body="Connect Stripe in test mode, upload signed payment receipts, or start with a demo business to try the whole flow."
              action={<Button size="sm" variant="ember" onClick={() => setOpen(true)}>Connect a source</Button>}
            />
          }
        >
          {(rows) => <div className="grid gap-6 xl:grid-cols-2">{rows.map((s) => <SourceCard key={s.id} src={s} />)}</div>}
        </QueryView>
        <ConnectDialog open={open} onOpenChange={setOpen} />
      </div>
    </RoleGate>
  );
}
