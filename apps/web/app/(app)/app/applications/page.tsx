"use client";

import { FileSignature, Inbox } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RoleGate } from "@/components/app/kit";
import { ConnectForSigning, useSigner } from "@/components/app/signing";
import {
  Button,
  ButtonLink,
  Dialog,
  DialogContent,
  EmptyState,
  PageHeader,
  Panel,
  Skeleton,
  Stat,
  StatusPill,
  toast,
  type StatusTone,
} from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { date, pct, usd } from "@/lib/format";
import { type ApplicationView, useBorrowerActions, useMyApplications } from "@/lib/portal";

const TONE: Record<ApplicationView["status"], StatusTone> = {
  SUBMITTED: "pending",
  APPROVED: "good",
  DECLINED: "loss",
  WITHDRAWN: "neutral",
  DRAWN: "public",
  EXPIRED: "neutral",
};
const LABEL: Record<ApplicationView["status"], string> = {
  SUBMITTED: "In review",
  APPROVED: "Approved: sign to draw",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
  DRAWN: "Funded",
  EXPIRED: "Expired",
};

function SignDialog({ app, onClose }: { app: ApplicationView; onClose: () => void }) {
  const a = useBorrowerActions();
  const signer = useSigner();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const termsMutate = a.terms.mutateAsync;

  useEffect(() => {
    termsMutate(app.id).then((r) => setMessage(r.message)).catch((e) => setError(errorMessage(e)));
  }, [app.id, termsMutate]);

  async function sign() {
    if (!message) return;
    setBusy(true);
    setError(null);
    try {
      const signature = signer.custodial ? null : await signer.signText(message);
      const loan = await a.accept.mutateAsync({ id: app.id, signature });
      toast.success(`${usd(loan.principal)} is on its way`, { description: `${loan.id} drawn from ${loan.pool.name}.` });
      onClose();
      router.push(`/app/loans/${loan.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title="Sign the loan agreement"
        description="Your signature accepts these terms. cUSD moves from the pool's vault to your wallet as soon as you sign."
        className="max-w-[560px]"
      >
        <div className="space-y-4">
          {message ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[16px] border border-line bg-black/60 p-4 font-mono text-[12.5px] leading-relaxed text-ink-2">{message}</pre>
          ) : (
            <Skeleton className="h-48 w-full rounded-[16px]" />
          )}
          <ConnectForSigning />
          {signer.custodial && <p className="text-[13px] text-ink-3">Your custodial wallet receives the funds; clicking Accept records your consent.</p>}
          {error && <p role="alert" className="text-[13.5px] text-loss-text">{error}</p>}
          <Button variant="ember" className="w-full" icon={<FileSignature className="size-4" />} busy={busy} disabled={!message || !signer.ready} onClick={sign}>
            {signer.custodial ? "Accept and receive funds" : "Sign with wallet and receive funds"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AppCard({ app, onSign }: { app: ApplicationView; onSign: () => void }) {
  const a = useBorrowerActions();
  return (
    <Panel className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/pools/${app.pool.slug}`} className="text-[16px] text-ink hover:underline">{app.pool.name}</Link>
          <p className="mt-1 text-[13px] text-ink-3">Applied {date(app.created_at)}{app.decided_at ? `, decided ${date(app.decided_at)}` : ""}{app.auto ? " (auto-approved)" : ""}</p>
        </div>
        <StatusPill tone={TONE[app.status]}>{LABEL[app.status]}</StatusPill>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Amount" value={<span className="num">{usd(app.requested)}</span>} />
        <Stat label="APR" value={pct(app.terms.apr_bps)} />
        <Stat label="Weekly installment" value={<span className="num">{usd(app.terms.installment)}</span>} />
        <Stat label="Proof" value={<Link href={`/proofs/${app.proof.id}`} className="num text-horizon-2 hover:underline">≥ {usd(app.proof.threshold)}</Link>} />
      </div>
      {app.decision_note && <p className="mt-4 rounded-[14px] border border-line bg-white/[0.02] p-3 text-[13.5px] text-ink-2">&ldquo;{app.decision_note}&rdquo;</p>}
      {(app.status === "APPROVED" || app.status === "SUBMITTED") && (
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button size="sm" variant="ghost" busy={a.withdraw.isPending} onClick={() => a.withdraw.mutate(app.id, { onError: (e) => toast.error(errorMessage(e)) })}>
            Withdraw
          </Button>
          {app.status === "APPROVED" && <Button size="sm" variant="ember" icon={<FileSignature className="size-3.5" />} onClick={onSign}>Sign and draw</Button>}
        </div>
      )}
      {app.status === "DRAWN" && (
        <div className="mt-5 flex justify-end border-t border-line pt-4">
          <ButtonLink href="/app/loans" size="sm" variant="ghost">View loan</ButtonLink>
        </div>
      )}
    </Panel>
  );
}

function Applications() {
  const q = useMyApplications();
  const params = useSearchParams();
  const [signing, setSigning] = useState<string | null>(params.get("open"));
  const rows = q.data ?? [];
  const target = rows.find((r) => r.id === signing && r.status === "APPROVED");
  if (q.isPending) return <Skeleton className="h-56 w-full rounded-[20px]" />;
  if (rows.length === 0)
    return (
      <EmptyState
        tone="ember"
        icon={<Inbox />}
        title="No applications yet"
        body="Apply to a pool with a revenue proof. Decisions and approvals show up here."
        action={<ButtonLink href="/app/pools" size="sm" variant="ember">Browse pools</ButtonLink>}
      />
    );
  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2">{rows.map((r) => <AppCard key={r.id} app={r} onSign={() => setSigning(r.id)} />)}</div>
      {target && <SignDialog app={target} onClose={() => setSigning(null)} />}
    </>
  );
}

export default function ApplicationsPage() {
  return (
    <RoleGate kind="BORROWER">
      <div className="space-y-8">
        <PageHeader title="Applications" description="Where each application stands. Approved ones need your signature to draw." />
        <Suspense fallback={<Skeleton className="h-56 w-full rounded-[20px]" />}>
          <Applications />
        </Suspense>
      </div>
    </RoleGate>
  );
}
