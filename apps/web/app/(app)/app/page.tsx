"use client";

import { ArrowUpRight, CalendarClock, ClipboardCheck, Droplets, FileCheck2, Layers, LineChart, PiggyBank, Store } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Checklist, WalletHero } from "@/components/app/kit";
import { Address, ButtonLink, EmptyState, Panel, PanelHeader, StatusPill, toast } from "@/components/ui";
import { errorMessage, post } from "@/lib/api";
import { qk } from "@/lib/queries";
import { useSession } from "@/lib/session";
import type { FaucetResult } from "@/lib/types";

function useFaucet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<FaucetResult>("/chain/faucet"),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: qk.balance });
      toast.success("Test cUSD is on its way", {
        action: { label: "View tx", onClick: () => window.open(r.explorer_url, "_blank", "noopener") },
      });
    },
    onError: (e) => toast.error("Faucet didn't run", { description: errorMessage(e) }),
  });
}

function Greeting() {
  const me = useSession();
  const first = me.user.name.split(" ")[0];
  return (
    <header className="mb-8">
      <h1 className="font-display text-[26px] font-light tracking-[-0.03em] text-ink md:text-[30px]">
        {first ? `Hello, ${first}` : "Overview"}
      </h1>
      <p className="mt-2 text-[15px] text-ink-2">
        {me.org.name}, <span className="font-mono text-[13px]">{me.org.pseudonym}</span> on the public ledger.
      </p>
    </header>
  );
}

function BorrowerOverview() {
  const me = useSession();
  const faucet = useFaucet();
  const primary = me.wallets.find((w) => w.is_primary) ?? me.wallets[0];
  return (
    <>
      <Greeting />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <WalletHero
            label="Wallet balance"
            footnote={primary ? <>Held in <Address value={primary.address} /> on Solana devnet</> : undefined}
            actions={[
              { href: "/app/revenue", icon: <LineChart />, label: "Connect revenue", sub: "Stripe, receipts or demo" },
              { href: "/app/proofs", icon: <FileCheck2 />, label: "Prove revenue", sub: "Zero-knowledge" },
              { href: "/app/pools", icon: <Store />, label: "Browse pools", sub: "Compare terms" },
              { onClick: () => faucet.mutate(), icon: <Droplets />, label: faucet.isPending ? "Minting…" : "Test cUSD", sub: "Devnet faucet" },
            ]}
          />
          <Panel>
            <PanelHeader title="Next installment" description="Taken automatically from customer payments in your lockbox." />
            <div className="p-5 md:p-6">
              <EmptyState
                tone="ember"
                icon={<CalendarClock />}
                title="No active loan"
                body="When you draw a loan, the week's installment and how much the lockbox has collected toward it appear here."
                action={
                  <ButtonLink href="/app/pools" size="sm" variant="ember">
                    Find a pool
                  </ButtonLink>
                }
              />
            </div>
          </Panel>
        </div>
        <div className="space-y-6">
          <Checklist
            title="Get to your first loan"
            items={[
              { label: "Confirm your email", done: me.user.email_verified },
              { label: "Set up your company", done: Boolean(me.org) },
              { label: "Link a wallet", done: me.wallets.length > 0, href: "/app/settings/wallets", cta: "Link" },
              { label: "Connect a revenue source", done: false, href: "/app/revenue", cta: "Connect", detail: "Stripe test mode, signed receipts or a demo business" },
              { label: "Generate a revenue proof", done: false, href: "/app/proofs", cta: "Prove", detail: "Choose the threshold lenders will see" },
              { label: "Apply to a pool", done: false, href: "/app/pools", cta: "Browse", detail: "Your proof is attached automatically" },
            ]}
          />
          <Panel className="p-5 md:p-6">
            <div className="flex items-start gap-3">
              <StatusPill tone="private">Private</StatusPill>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
              Lenders only ever see your pseudonym, your proven threshold and your repayment record. Your company profile is
              shared with a pool manager only when you apply to their pool.
            </p>
            <ButtonLink href="/docs#privacy" size="sm" variant="ghost" className="mt-3 -ml-3" iconRight={<ArrowUpRight className="size-3.5" />}>
              Privacy model
            </ButtonLink>
          </Panel>
        </div>
      </div>
    </>
  );
}

function LenderOverview() {
  const me = useSession();
  const faucet = useFaucet();
  const primary = me.wallets.find((w) => w.is_primary) ?? me.wallets[0];
  return (
    <>
      <Greeting />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <WalletHero
            label="Wallet balance, ready to deploy"
            footnote={primary ? <>Held in <Address value={primary.address} /> on Solana devnet</> : undefined}
            actions={[
              { href: "/app/my-pools", icon: <Layers />, label: "Create a pool", sub: "Set your terms" },
              { href: "/app/funds", icon: <PiggyBank />, label: "Deposit", sub: "Senior or junior" },
              { href: "/app/review", icon: <ClipboardCheck />, label: "Review queue", sub: "Approve or decline" },
              { onClick: () => faucet.mutate(), icon: <Droplets />, label: faucet.isPending ? "Minting…" : "Test cUSD", sub: "Devnet faucet" },
            ]}
          />
          <Panel>
            <PanelHeader title="Deployed capital" description="Across every pool you manage, by tranche." />
            <div className="p-5 md:p-6">
              <EmptyState
                tone="horizon"
                icon={<Layers />}
                title="You don't manage a pool yet"
                body="Create a pool with your terms, fund its junior tranche, and open it for applications. Its capital stack and yield show up here."
                action={
                  <ButtonLink href="/app/my-pools" size="sm" variant="horizon">
                    Create a pool
                  </ButtonLink>
                }
              />
            </div>
          </Panel>
        </div>
        <div className="space-y-6">
          <Checklist
            title="Open your first pool"
            items={[
              { label: "Confirm your email", done: me.user.email_verified },
              { label: "Set up your company", done: Boolean(me.org) },
              { label: "Link a wallet", done: me.wallets.length > 0, href: "/app/settings/wallets", cta: "Link" },
              { label: "Create a pool", done: false, href: "/app/my-pools", cta: "Create", detail: "Coupon, APR, advance rate, term" },
              { label: "Fund the junior tranche", done: false, href: "/app/funds", cta: "Deposit", detail: "First-loss capital lets senior in" },
              { label: "Open for applications", done: false, href: "/app/my-pools", cta: "Open" },
            ]}
          />
          <Panel className="p-5 md:p-6">
            <h2 className="text-[15px] text-ink">Your public profile</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
              Investors see your company and every pool you run, with loans and losses straight from the ledger.
            </p>
            <ButtonLink href={`/lenders/${me.org.slug}`} size="sm" variant="ghost" className="mt-3 -ml-3" iconRight={<ArrowUpRight className="size-3.5" />}>
              View profile
            </ButtonLink>
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function OverviewPage() {
  const me = useSession();
  return me.org.kind === "LENDER" ? <LenderOverview /> : <BorrowerOverview />;
}
