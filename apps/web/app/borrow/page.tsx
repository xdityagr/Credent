"use client";

import { useEffect } from "react";
import { DrawStep, NotarizeStep, ProveStep, RevenueEnvelope } from "@/components/borrow/ProveSteps";
import { Lockbox } from "@/components/borrow/Lockbox";
import { SourceStep } from "@/components/borrow/SourceStep";
import { SignIn } from "@/components/SignIn";
import { Notice } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/useApi";
import type { BorrowerView } from "@/lib/types";

const STEPS = ["Connect revenue", "Notarize", "Prove", "Draw"];

export default function BorrowPage() {
  const { session, ready, signOut } = useSession();
  const { data: view, error, code, refresh } = useApi<BorrowerView>(
    session ? "/borrower/me" : null,
    session?.token,
  );

  // A world reset wipes sessions; send the user back to sign-in.
  useEffect(() => {
    if (code === "UNAUTHORIZED") signOut();
  }, [code, signOut]);

  if (!ready) return null;
  if (!session)
    return (
      <Page>
        <SignIn
          title="Sign in to borrow"
          body="Your wallet identifies your business. Revenue you connect stays private to this wallet."
        />
      </Page>
    );

  if (error && code !== "UNAUTHORIZED") return <Page><Notice>{error}</Notice></Page>;
  if (!view) return <Page><p className="text-ink-faint">Loading your account…</p></Page>;

  const step = !view.series ? 0 : !view.attestation ? 1 : !view.credit_line ? 2 : !view.loan ? 3 : 4;

  if (step === 4) {
    return (
      <div>
        <Header title="Your loan" lead="Customer payments land in the lockbox and repay what is due before anything reaches you." />
        <Lockbox view={view} />
      </div>
    );
  }

  return (
    <Page>
      <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-[15px]" aria-label="Onboarding steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
                i < step ? "bg-junior text-sheet" : i === step ? "bg-ink text-sheet" : "border border-rule-strong text-ink-faint"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={i === step ? "font-semibold text-ink" : "text-ink-soft"}>{s}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <>
          <Header title="Connect your revenue" lead="Pick a source. Raw figures never leave the private side of Credent." />
          <SourceStep token={session.token} onDone={refresh} />
        </>
      )}
      {step === 1 && (
        <>
          <Header title="Notarize your revenue" lead="Lock your 90-day revenue into a commitment the notary signs." />
          <div className="space-y-6">
            <RevenueEnvelope view={view} />
            <NotarizeStep token={session.token} onDone={refresh} />
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <Header title="Prove it without showing it" lead="Pick the threshold to prove. A zero-knowledge proof shows your revenue clears it; the figures stay sealed." />
          <ProveStep token={session.token} view={view} onDone={refresh} />
        </>
      )}
      {step === 3 && (
        <>
          <Header title="Draw from your credit line" lead="Your proof is on the public ledger. Draw now; repayment comes out of incoming payments." />
          <DrawStep token={session.token} view={view} onDone={refresh} />
        </>
      )}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[880px]">{children}</div>;
}

function Header({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mb-7">
      <h1 className="text-[36px] font-extrabold tracking-[-0.035em] text-ink">{title}</h1>
      <p className="mt-2 max-w-[40rem] text-[17px] leading-relaxed text-ink-soft">{lead}</p>
    </div>
  );
}
