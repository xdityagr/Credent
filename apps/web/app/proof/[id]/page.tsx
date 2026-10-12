"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button, Hash, Notice, Sheet } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { sourceName } from "@/lib/events";
import { usd } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { ProofVerify, PublicProof } from "@/lib/types";

export default function ProofPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, error } = useApi<PublicProof>(`/public/proofs/${id}`);
  const [result, setResult] = useState<ProofVerify | null>(null);
  const [busy, setBusy] = useState(false);
  const [vErr, setVErr] = useState<string | null>(null);

  if (error) return <Notice>{error}</Notice>;
  if (!p) return <p className="text-ink-faint">Loading proof…</p>;

  const a = p.attestation;
  const kb = (b64: string) => `${((b64.length * 3) / 4 / 1024).toFixed(1)} KB`;

  function download(name: string, b64: string) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes]));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${p!.id}.${name}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-[920px] space-y-8">
      <div>
        <Link href="/explorer" className="text-[14px] font-semibold text-ink-soft hover:text-ink">
          Back to the public book
        </Link>
        <h1 className="mt-3 text-[34px] font-extrabold tracking-[-0.035em] text-ink">
          {p.borrower} earned at least {usd(p.threshold)} in 90 days
        </h1>
        <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">
          That is the whole claim. The daily figures behind it were never published; this page lets you check the claim
          without them.
        </p>
      </div>

      <Sheet className="p-6">
        <h2 className="text-[18px] font-semibold text-ink">Check it yourself</h2>
        <p className="mt-1 max-w-[44rem] text-[15px] leading-relaxed text-ink-soft">
          Re-runs the UltraHonk verifier over the stored proof, then confirms the proof is bound to this threshold and to
          the commitment the notary signed.
        </p>
        <div className="mt-4">
          <Button
            busy={busy}
            onClick={async () => {
              setBusy(true);
              setVErr(null);
              try {
                setResult(await api<ProofVerify>(`/public/proofs/${p.id}/verify`, { method: "POST" }));
              } catch (e) {
                setVErr(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Verify proof
          </Button>
        </div>
        {vErr && <div className="mt-4"><Notice>{vErr}</Notice></div>}
        {result && (
          <ul className="mt-5 space-y-2 text-[15px]">
            <Check ok={result.proof_valid} text={`Proof verifies (${result.verifier}, ${result.ms} ms)`} />
            <Check ok={result.threshold_bound} text={`Public threshold equals ${usd(p.threshold)}`} />
            <Check ok={result.commitment_bound} text="Public commitment equals the notarized commitment" />
            <Check ok={result.attestation_valid} text="Notary signature over the commitment is valid" />
            <li className={`pt-2 text-[16px] font-semibold ${result.valid ? "text-junior" : "text-loss"}`}>
              {result.valid ? "Valid. The claim holds." : "Invalid. Do not rely on this claim."}
            </li>
          </ul>
        )}
      </Sheet>

      <div className="grid gap-6 md:grid-cols-2">
        <Sheet className="p-6">
          <h2 className="text-[18px] font-semibold text-ink">Public inputs</h2>
          <dl className="mt-3 space-y-3 text-[14px]">
            <Row k="Claim"><code className="font-mono text-[13px] text-ink">{p.claim}</code></Row>
            <Row k="Threshold">{usd(p.threshold)}</Row>
            <Row k="Commitment"><Hash value={p.commitment} full /></Row>
          </dl>
        </Sheet>
        <Sheet className="p-6">
          <h2 className="text-[18px] font-semibold text-ink">Notary attestation</h2>
          <dl className="mt-3 space-y-3 text-[14px]">
            <Row k="Source">{sourceName(a.source)}</Row>
            <Row k="Period">days {a.period_start} to {a.period_end - 1}</Row>
            <Row k="Account">
              <Hash value={a.account_hash} /> <span className="text-ink-faint">(salted hash)</span>
            </Row>
            <Row k="Notary key"><Hash value={a.notary_pubkey} /></Row>
            <Row k="Signature"><Hash value={a.signature} head={10} tail={6} /></Row>
          </dl>
        </Sheet>
      </div>

      <Sheet className="p-6">
        <h2 className="text-[18px] font-semibold text-ink">Artifacts</h2>
        <p className="mt-1 text-[14px] text-ink-faint">
          Verify offline with Barretenberg: <code className="font-mono">bb verify -p proof -i public_inputs -k vk</code>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="quiet" onClick={() => download("proof", p.proof_b64)}>Proof ({kb(p.proof_b64)})</Button>
          <Button variant="quiet" onClick={() => download("public_inputs", p.public_inputs_b64)}>Public inputs</Button>
          <Button variant="quiet" onClick={() => download("vk", p.vk_b64)}>Verification key ({kb(p.vk_b64)})</Button>
        </div>
      </Sheet>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3">
      <dt className="text-ink-faint">{k}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[12px] font-bold ${
          ok ? "bg-junior text-sheet" : "bg-loss text-sheet"
        }`}
      >
        {ok ? "✓" : "×"}
      </span>
      <span className={ok ? "text-ink" : "font-semibold text-loss"}>{ok ? text : `Failed: ${text}`}</span>
    </li>
  );
}
