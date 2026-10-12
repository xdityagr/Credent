"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download, ShieldCheck, XCircle } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { Container } from "@/components/site/page-hero";
import { Button, ButtonLink, ColumnLines, EmptyState, ErrorState, Hash, Panel, PanelHeader, Skeleton } from "@/components/ui";
import { ApiError, errorMessage, post } from "@/lib/api";
import { sourceName } from "@/lib/events";
import { usd } from "@/lib/format";
import { useProof } from "@/lib/queries";
import type { ProofVerify } from "@/lib/types";

export function ProofView({ id }: { id: string }) {
  const q = useProof(id);
  const verify = useMutation({ mutationFn: () => post<ProofVerify>(`/public/proofs/${id}/verify`) });
  const p = q.data;

  if (q.error instanceof ApiError && q.error.status === 404) {
    return (
      <Container className="pb-24 pt-40">
        <EmptyState
          title="No proof with this ID"
          body="Check the link, or find proofs from the loan book in the explorer."
          action={
            <ButtonLink href="/explorer" size="sm" variant="white">
              Open the explorer
            </ButtonLink>
          }
        />
      </Container>
    );
  }

  const kb = (b64: string) => `${((b64.length * 3) / 4 / 1024).toFixed(1)} KB`;
  const download = (name: string, b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}.${name}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const r = verify.data;
  const checks: [boolean, string][] = r && p
    ? [
        [r.proof_valid, `Proof verifies (${r.verifier}, ${r.ms} ms)`],
        [r.vk_pinned, "Verification key is the revenue circuit's, and matches the hash on the ledger"],
        [r.threshold_bound, `Public threshold equals ${usd(p.threshold)}`],
        [r.commitment_bound, "Public commitment equals the notarized commitment"],
        [r.attestation_valid, "Notary signature over the commitment is valid"],
        [r.notary_trusted, "Signed by Credent's published notary key"],
      ]
    : [];

  return (
    <>
      <section className="relative isolate overflow-hidden pt-[76px]">
        <ColumnLines cols={4} className="mx-auto max-w-[1280px] [mask-image:linear-gradient(180deg,#000,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40%_70%_at_30%_0%,rgb(255_138_61/0.14),transparent_75%)]" />
        <Container className="pb-12 pt-10 md:pt-14">
          <Link href="/explorer" className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-2 transition hover:text-ink">
            <ArrowLeft className="size-4" /> Public book
          </Link>
          {p ? (
            <>
              <p className="mt-8 font-mono text-[13px] text-ink-3">Revenue proof {p.id}</p>
              <h1 className="mt-3 max-w-[20ch] font-serif text-[clamp(38px,5vw,68px)] leading-[1] tracking-[-0.03em] text-[#f4f1ee]">
                {p.borrower} earned at least <span className="italic">{usd(p.threshold)}</span> in 90 days
              </h1>
              <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-ink-2">
                That is the whole claim. The daily figures behind it were never published. This page lets you check the claim
                without them.
              </p>
            </>
          ) : q.isPending ? (
            <div className="mt-8 space-y-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-14 w-[min(640px,90%)]" />
              <Skeleton className="h-4 w-[min(520px,80%)]" />
            </div>
          ) : (
            <div className="mt-8">
              <ErrorState error={q.error} onRetry={() => q.refetch()} />
            </div>
          )}
        </Container>
      </section>

      {p && (
        <Container className="space-y-6 pb-24">
          <Panel className="relative overflow-hidden">
            <PanelHeader
              title="Check it yourself"
              description="Re-runs the UltraHonk verifier over the stored proof, then confirms the proof is bound to this threshold and to the commitment the notary signed."
            />
            <div className="p-5 md:p-6">
              <Button variant="ember" busy={verify.isPending} onClick={() => verify.mutate()} icon={<ShieldCheck className="size-4" />} magnetic>
                Verify proof
              </Button>
              {verify.error && <p className="mt-4 text-[14px] text-loss-text">{errorMessage(verify.error)}</p>}
              {r && (
                <ul className="mt-6 space-y-2.5">
                  {checks.map(([ok, text], i) => (
                    <motion.li
                      key={text}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-2.5 text-[14.5px]"
                    >
                      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-junior-text" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-loss-text" />}
                      <span className={ok ? "text-ink" : "text-loss-text"}>{ok ? text : `Failed: ${text}`}</span>
                    </motion.li>
                  ))}
                  <motion.li
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: checks.length * 0.08 }}
                    className={`pt-3 font-display text-[18px] font-light ${r.valid ? "text-junior-text" : "text-loss-text"}`}
                  >
                    {r.valid ? "Valid. The claim holds." : "Invalid. Do not rely on this claim."}
                  </motion.li>
                </ul>
              )}
            </div>
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel>
              <PanelHeader title="Public inputs" />
              <dl className="space-y-3.5 p-5 text-[14px] md:p-6">
                <Row k="Claim">
                  <code className="font-mono text-[12.5px] text-ink">{p.claim}</code>
                </Row>
                <Row k="Threshold">
                  <span className="num">{usd(p.threshold)}</span>
                </Row>
                <Row k="Commitment">
                  <Hash value={p.commitment} full />
                </Row>
              </dl>
            </Panel>
            <Panel>
              <PanelHeader title="Notary attestation" />
              <dl className="space-y-3.5 p-5 text-[14px] md:p-6">
                <Row k="Source">{sourceName(p.attestation.source)}</Row>
                <Row k="Period">
                  days {p.attestation.period_start} to {p.attestation.period_end - 1}
                </Row>
                <Row k="Account">
                  <Hash value={p.attestation.account_hash} /> <span className="text-[12.5px] text-ink-3">salted hash</span>
                </Row>
                <Row k="Notary key">
                  <Hash value={p.attestation.notary_pubkey} />
                </Row>
                <Row k="Signature">
                  <Hash value={p.attestation.signature} head={10} tail={6} />
                </Row>
              </dl>
            </Panel>
          </div>

          <Panel>
            <PanelHeader
              title="Artifacts"
              description={
                <>
                  Verify offline with Barretenberg: <code className="font-mono text-[12.5px] text-ink">bb verify -p proof -i public_inputs -k vk</code>
                </>
              }
            />
            <div className="flex flex-wrap gap-2 p-5 md:p-6">
              <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => download("proof", p.proof_b64)}>
                Proof ({kb(p.proof_b64)})
              </Button>
              <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => download("public_inputs", p.public_inputs_b64)}>
                Public inputs
              </Button>
              <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => download("vk", p.vk_b64)}>
                Verification key ({kb(p.vk_b64)})
              </Button>
            </div>
          </Panel>
        </Container>
      )}
    </>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3">
      <dt className="text-ink-3">{k}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}
