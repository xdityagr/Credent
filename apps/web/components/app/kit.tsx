"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Droplets } from "lucide-react";
import Link from "next/link";
import { BigAmount, Button, ButtonLink, EmptyState, PageHeader, Skeleton, toast } from "@/components/ui";
import { errorMessage, post } from "@/lib/api";
import { cn } from "@/lib/cn";
import { qk, useBalance } from "@/lib/queries";
import { useSession } from "@/lib/session";
import type { FaucetResult, OrgKind } from "@/lib/types";

/** Shows children only for the given org kind; otherwise explains where to go. */
export function RoleGate({ kind, children }: { kind: OrgKind; children: React.ReactNode }) {
  const me = useSession();
  if (me.org.kind === kind) return <>{children}</>;
  return (
    <EmptyState
      className="mt-10"
      title={kind === "BORROWER" ? "This page is for borrower companies" : "This page is for lender companies"}
      body={`${me.org.name} is a ${me.org.kind === "LENDER" ? "lender" : "borrower"} company. Head back to your overview for the tools that fit your side.`}
      action={
        <ButtonLink href="/app" size="sm" variant="white">
          Go to overview
        </ButtonLink>
      }
    />
  );
}

/** Mint test cUSD to the primary wallet. */
export function FaucetButton({ size = "md", variant = "glass" }: { size?: "sm" | "md"; variant?: "glass" | "white" | "horizon" | "ember" }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => post<FaucetResult>("/chain/faucet"),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: qk.balance });
      toast.success("Test cUSD is on its way", {
        description: "Minted to your wallet.",
        action: { label: "View tx", onClick: () => window.open(r.explorer_url, "_blank", "noopener") },
      });
    },
    onError: (e) => toast.error("Faucet didn't run", { description: errorMessage(e) }),
  });
  return (
    <Button size={size} variant={variant} busy={m.isPending} icon={<Droplets className="size-4" />} onClick={() => m.mutate()}>
      Get test cUSD
    </Button>
  );
}

/**
 * WalletHero: wallet-style balance card (refs 2–5). Wide display numerals over a
 * blurred ember or horizon blob, with square action tiles underneath.
 */
export function WalletHero({
  label,
  actions,
  footnote,
}: {
  label: string;
  actions: { href?: string; onClick?: () => void; icon: React.ReactNode; label: string; sub?: string }[];
  footnote?: React.ReactNode;
}) {
  const me = useSession();
  const tone = me.org.kind === "LENDER" ? "horizon" : "ember";
  const primary = me.wallets.find((w) => w.is_primary) ?? me.wallets[0];
  const balance = useBalance(Boolean(primary));
  return (
    <section className="relative isolate overflow-hidden rounded-[28px] border border-line bg-[#0a0a0b]">
      <div
        aria-hidden
        className="absolute -right-[10%] -top-[60%] -z-10 size-[620px] rounded-full blur-[70px]"
        style={{
          background:
            tone === "ember"
              ? "radial-gradient(circle at 40% 55%, #ff8a3d 0%, #e2452b 28%, rgb(58 15 10 / 0.7) 50%, transparent 66%)"
              : "radial-gradient(circle at 40% 55%, #8fb4ff 0%, #2d5bff 30%, rgb(20 40 120 / 0.6) 52%, transparent 68%)",
          opacity: 0.75,
        }}
      />
      <div
        aria-hidden
        className="absolute -right-[4%] -top-[30%] -z-10 size-[420px] rounded-full blur-[60px]"
        style={{ background: tone === "ember" ? "radial-gradient(circle, #0f3b3a, transparent 65%)" : "radial-gradient(circle, rgb(127 227 255 / 0.25), transparent 65%)" }}
      />
      <div className="p-6 md:p-8">
        <div className="text-[13.5px] text-ink-2">{label}</div>
        <div className="mt-4 min-h-[56px]">
          {primary ? (
            balance.isPending ? (
              <Skeleton className="h-12 w-56" />
            ) : (
              <BigAmount cents={balance.data?.cusd ?? null} size="xl" />
            )
          ) : (
            <span className="text-[15px] text-ink-2">Link a wallet in Settings to see your balance.</span>
          )}
        </div>
        {footnote && <div className="mt-3 text-[13px] text-ink-3">{footnote}</div>}
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
        {actions.map((a) => {
          const inner = (
            <>
              <span className="text-ink [&_svg]:size-[18px]">{a.icon}</span>
              <span className="mt-3 block text-[14px] text-ink">{a.label}</span>
              {a.sub && <span className="mt-0.5 block text-[12px] text-ink-3">{a.sub}</span>}
            </>
          );
          const cls = "group flex flex-col items-start bg-[#0a0a0b]/90 p-5 text-left transition hover:bg-[#111113] active:scale-[0.98]";
          return a.href ? (
            <Link key={a.label} href={a.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={a.label} type="button" onClick={a.onClick} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Getting-started checklist. */
export function Checklist({
  title,
  items,
}: {
  title: string;
  items: { label: string; done: boolean; href?: string; cta?: string; detail?: string }[];
}) {
  const done = items.filter((i) => i.done).length;
  return (
    <section className="panel rounded-[24px] p-5 md:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-medium text-ink">{title}</h2>
        <span className="num text-[13px] text-ink-3">
          {done} of {items.length}
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-white/70 transition-[width] duration-700" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ol className="mt-5 space-y-1">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-3 rounded-[12px] py-2">
            <span
              className={cn(
                "inline-flex size-6 shrink-0 items-center justify-center rounded-full border",
                it.done ? "border-junior/50 bg-junior/15 text-junior-text" : "border-line-strong text-transparent",
              )}
              aria-hidden
            >
              <Check className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-[14px]", it.done ? "text-ink-3 line-through decoration-white/20" : "text-ink")}>{it.label}</span>
              {it.detail && !it.done && <span className="block text-[12.5px] text-ink-3">{it.detail}</span>}
            </span>
            <span className="sr-only">{it.done ? "Done" : "To do"}</span>
            {!it.done && it.href && (
              <ButtonLink href={it.href} size="sm" variant="ghost">
                {it.cta ?? "Start"}
              </ButtonLink>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Placeholder page: header plus a purposeful empty state, and a faint preview
 * of the layout that will fill in. The real data views are built on top.
 */
export function PlaceholderPage({
  title,
  description,
  empty,
  preview = "table",
  actions,
  children,
}: {
  title: string;
  description: string;
  empty: React.ReactNode;
  preview?: "table" | "cards" | "none";
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} actions={actions} />
      {empty}
      {children}
      {preview !== "none" && (
        <div aria-hidden className="pointer-events-none select-none opacity-[0.35] [mask-image:linear-gradient(180deg,#000,transparent)]">
          {preview === "table" ? (
            <div className="rounded-[20px] border border-line">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-6 border-b border-line px-5 py-4 last:border-0">
                  <span className="h-3 w-24 rounded bg-white/[0.07]" />
                  <span className="h-3 flex-1 rounded bg-white/[0.05]" />
                  <span className="h-3 w-20 rounded bg-white/[0.07]" />
                  <span className="h-5 w-16 rounded-full bg-white/[0.06]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-40 rounded-[20px] border border-line bg-white/[0.015]" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
