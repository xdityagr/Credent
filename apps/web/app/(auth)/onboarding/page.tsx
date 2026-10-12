"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Check, Landmark, Loader2, LogOut, MailWarning } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoUpload } from "@/components/app/logo-upload";
import { OrgForm, type OrgValues } from "@/components/app/org-form";
import { WalletLink } from "@/components/app/wallet-link";
import { Button, ButtonLink, ColumnLines, ErrorState, OrgAvatar, Stepper, Wordmark } from "@/components/ui";
import { post } from "@/lib/api";
import { useResendVerification } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { short } from "@/lib/format";
import { qk, useLogout, useMe } from "@/lib/queries";
import type { Me, Org, OrgKind } from "@/lib/types";

const STEPS = ["Role", "Company", "Logo", "Wallet", "Done"];

function serverStepIndex(me: Me): number {
  switch (me.onboarding.step) {
    case "role":
    case "verify_email":
      return 0;
    case "company":
      return 1;
    case "logo":
      return 2;
    case "wallet":
      return me.org?.logo_url ? 3 : 2;
    default:
      return 4;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const logout = useLogout();
  const [override, setOverride] = useState<number | null>(null);
  const [kind, setKind] = useState<OrgKind | null>(null);

  const createOrg = useMutation({
    mutationFn: (v: OrgValues & { kind: OrgKind }) => post<Org>("/orgs", v),
    onSuccess: (org) => {
      qc.setQueryData<Me | null>(qk.me, (old) => (old ? { ...old, org, onboarding: { step: "wallet" } } : old));
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });

  useEffect(() => {
    if (me.data === null) router.replace("/login?next=/onboarding");
  }, [me.data, router]);

  const data = me.data;
  const step = data ? (override ?? serverStepIndex(data)) : 0;
  const tone: "ember" | "horizon" = (data?.org?.kind ?? kind) === "LENDER" ? "horizon" : "ember";

  return (
    <div className="relative isolate min-h-dvh overflow-hidden">
      <ColumnLines cols={4} className="mx-auto max-w-[1280px] [mask-image:linear-gradient(180deg,#000,transparent_80%)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-200px] -z-10 h-[600px] w-[1100px] -translate-x-1/2 blur-3xl transition-[background] duration-700"
        style={{
          background:
            tone === "horizon"
              ? "radial-gradient(45% 50% at 50% 40%, rgb(45 91 255 / 0.22), transparent 70%)"
              : "radial-gradient(45% 50% at 50% 40%, rgb(226 69 43 / 0.18), rgb(15 59 58 / 0.12) 60%, transparent 75%)",
        }}
      />
      <header className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="Credent home">
          <Wordmark />
        </Link>
        {data && (
          <button
            type="button"
            onClick={() => logout.mutate(undefined, { onSettled: () => router.replace("/login") })}
            className="inline-flex items-center gap-2 text-[13.5px] text-ink-2 transition hover:text-ink"
          >
            <LogOut className="size-4" /> Log out
          </button>
        )}
      </header>

      <main id="main" className="mx-auto max-w-[680px] px-5 pb-24 pt-6 md:pt-12">
        {me.isPending ? (
          <div className="flex justify-center py-32 text-ink-3">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : me.error ? (
          <ErrorState error={me.error} onRetry={() => me.refetch()} />
        ) : !data ? null : data.onboarding.step === "verify_email" ? (
          <VerifyFirst email={data.user.email} />
        ) : (
          <>
            <Stepper steps={STEPS} current={step} tone={tone} className="mb-12" />
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {step === 0 && (
                  <RoleStep
                    name={data.user.name}
                    kind={kind}
                    onKind={setKind}
                    onNext={() => setOverride(1)}
                  />
                )}
                {step === 1 && (
                  <StepFrame
                    title="About your company"
                    description={
                      kind === "LENDER"
                        ? "This appears on your public lender profile and on every pool you run."
                        : "Pool managers see this when you apply. The public ledger only ever shows your pseudonym."
                    }
                  >
                    <OrgForm
                      kind={kind ?? "BORROWER"}
                      submitLabel="Save and continue"
                      busy={createOrg.isPending}
                      error={createOrg.error}
                      onSubmit={async (v) => {
                        await createOrg.mutateAsync({ ...v, kind: kind ?? "BORROWER" });
                        setOverride(2);
                      }}
                      secondary={
                        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setOverride(0)}>
                          Back
                        </Button>
                      }
                    />
                  </StepFrame>
                )}
                {step === 2 && data.org && (
                  <StepFrame title="Add your logo" description="It helps pool managers and investors recognise you. You can change it later in Settings.">
                    <LogoUpload org={data.org} onUploaded={() => setOverride(3)} />
                    <div className="mt-10 flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setOverride(3)}>
                        Skip for now
                      </Button>
                      <Button variant="white" onClick={() => setOverride(3)} disabled={!data.org.logo_url}>
                        Continue
                      </Button>
                    </div>
                  </StepFrame>
                )}
                {step === 3 && (
                  <StepFrame
                    title="Link a wallet"
                    description="Loans, deposits and repayments settle in cUSD on Solana devnet. Credent pays every network fee, so you never need SOL."
                  >
                    <WalletLink
                      onLinked={() => {
                        qc.invalidateQueries({ queryKey: qk.me });
                        setOverride(4);
                      }}
                    />
                  </StepFrame>
                )}
                {step === 4 && <DoneStep me={data} />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}

function StepFrame({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="font-serif text-[clamp(38px,5vw,56px)] leading-[1] tracking-[-0.03em] text-[#f4f1ee]">{title}</h1>
      {description && <p className="mt-4 max-w-[56ch] text-[15.5px] leading-relaxed text-ink-2">{description}</p>}
      <div className="mt-10">{children}</div>
    </section>
  );
}

function RoleStep({
  name,
  kind,
  onKind,
  onNext,
}: {
  name: string;
  kind: OrgKind | null;
  onKind: (k: OrgKind) => void;
  onNext: () => void;
}) {
  const first = name.split(" ")[0];
  const cards = [
    {
      k: "BORROWER" as const,
      icon: Building2,
      title: "Borrower company",
      body: "Prove revenue privately and borrow working capital from lender pools. Repay from sales.",
      points: ["Revenue stays private", "Weekly installments from a lockbox"],
      active: "border-ember-1/60 shadow-[0_0_80px_-20px_rgb(255_138_61/0.6)]",
      glow: "radial-gradient(80% 70% at 100% 0%, rgb(255 138 61 / 0.25), rgb(226 69 43 / 0.08) 50%, transparent 75%)",
      chip: "text-ember-1",
    },
    {
      k: "LENDER" as const,
      icon: Landmark,
      title: "Lender company",
      body: "Run pools with your own terms, fund senior or junior tranches, and approve applications.",
      points: ["Senior coupon or junior residual", "Reserves verified on Solana"],
      active: "border-horizon-2/60 shadow-[0_0_80px_-20px_rgb(45_91_255/0.7)]",
      glow: "radial-gradient(80% 70% at 100% 0%, rgb(45 91 255 / 0.3), rgb(127 227 255 / 0.06) 50%, transparent 75%)",
      chip: "text-horizon-2",
    },
  ];
  return (
    <StepFrame title={`Welcome${first ? `, ${first}` : ""}. Which side are you on?`} description="Each company is either a borrower or a lender. You can't switch later, but you can create another account.">
      <div role="radiogroup" aria-label="Company role" className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => {
          const on = kind === c.k;
          return (
            <button
              key={c.k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onKind(c.k)}
              className={cn(
                "group relative isolate overflow-hidden rounded-[28px] border bg-white/[0.025] p-6 text-left backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-300 active:scale-[0.98]",
                on ? c.active : "border-line-strong hover:border-white/25",
              )}
            >
              <span aria-hidden className={cn("absolute inset-0 -z-10 transition-opacity duration-500", on ? "opacity-100" : "opacity-40 group-hover:opacity-70")} style={{ background: c.glow }} />
              <span className="flex items-start justify-between">
                <span className={cn("glass inline-flex size-12 items-center justify-center rounded-[16px]", c.chip)}>
                  <c.icon className="size-5" />
                </span>
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full border transition",
                    on ? "border-white bg-white text-black" : "border-line-strong text-transparent",
                  )}
                >
                  <Check className="size-3.5" />
                </span>
              </span>
              <span className="mt-8 block font-display text-[20px] font-light tracking-[-0.02em] text-ink">{c.title}</span>
              <span className="mt-2 block text-[14px] leading-relaxed text-ink-2">{c.body}</span>
              <span className="mt-5 block space-y-1.5">
                {c.points.map((p) => (
                  <span key={p} className="flex items-center gap-2 text-[13px] text-ink-2">
                    <Check className={cn("size-3.5", c.chip)} /> {p}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-10 flex justify-end">
        <Button variant="white" size="lg" disabled={!kind} onClick={onNext}>
          Continue
        </Button>
      </div>
    </StepFrame>
  );
}

function DoneStep({ me }: { me: Me }) {
  const org = me.org;
  const w = me.wallets.find((x) => x.is_primary) ?? me.wallets[0];
  return (
    <section className="text-center">
      <span className="glass mx-auto inline-flex size-16 items-center justify-center rounded-[20px] text-junior-text shadow-[0_0_60px_rgb(31_169_122/0.35)]">
        <Check className="size-7" />
      </span>
      <h1 className="mt-8 font-serif text-[clamp(44px,6vw,72px)] leading-[0.98] tracking-[-0.03em] text-[#f4f1ee]">
        You&apos;re <span className="italic">set up.</span>
      </h1>
      {org && (
        <div className="glass mx-auto mt-10 flex max-w-[440px] items-center gap-4 rounded-[24px] p-5 text-left">
          <OrgAvatar name={org.name} src={org.logo_url} kind={org.kind} size={52} />
          <div className="min-w-0">
            <div className="truncate text-[16px] text-ink">{org.name}</div>
            <div className="text-[13px] text-ink-2">
              {org.kind === "LENDER" ? "Lender company" : "Borrower company"}, public name <span className="font-mono">{org.pseudonym}</span>
            </div>
            {w && <div className="mt-1 font-mono text-[12px] text-ink-3">Wallet {short(w.address, 6, 6)}</div>}
          </div>
        </div>
      )}
      <p className="mx-auto mt-8 max-w-[46ch] text-[15.5px] leading-relaxed text-ink-2">
        {org?.kind === "LENDER"
          ? "Next: create your first pool, fund its junior tranche and open it for applications."
          : "Next: connect a revenue source and generate your first revenue proof."}
      </p>
      <div className="mt-8 flex justify-center">
        <ButtonLink href="/app" variant={org?.kind === "LENDER" ? "horizon" : "ember"} size="lg">
          Go to your dashboard
        </ButtonLink>
      </div>
    </section>
  );
}

function VerifyFirst({ email }: { email: string }) {
  const resend = useResendVerification();
  return (
    <section className="text-center">
      <span className="glass mx-auto inline-flex size-16 items-center justify-center rounded-[20px] text-ember-1">
        <MailWarning className="size-7" />
      </span>
      <h1 className="mt-8 font-serif text-[clamp(40px,5vw,60px)] leading-[1] tracking-[-0.03em] text-[#f4f1ee]">Confirm your email first</h1>
      <p className="mx-auto mt-5 max-w-[46ch] text-[15.5px] leading-relaxed text-ink-2">
        We sent a link to <span className="text-ink">{email}</span>. Open it and you&apos;ll come straight back here.
      </p>
      <div className="mt-8 flex justify-center">
        {resend.isSuccess ? (
          <p className="text-junior-text">A new link is on its way.</p>
        ) : (
          <Button busy={resend.isPending} onClick={() => resend.mutate(email)}>
            Send the link again
          </Button>
        )}
      </div>
    </section>
  );
}
