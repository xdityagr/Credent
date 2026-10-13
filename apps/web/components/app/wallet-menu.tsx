"use client";

/* eslint-disable @next/next/no-img-element -- wallet adapter icons are data URLs */
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronDown, Plus, Settings, Star, Wallet as WalletIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaucetButton } from "@/components/app/kit";
import { WalletIdentity } from "@/components/app/wallet-identity";
import { WalletLink } from "@/components/app/wallet-link";
import { Address, Button, Sheet, SheetContent, SheetTrigger, Skeleton, StatusPill, toast } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { short, usd } from "@/lib/format";
import { qk, useBalance, useWalletMutations } from "@/lib/queries";
import type { Me } from "@/lib/types";

/**
 * Topbar wallet pill. Opens a drawer with the cUSD balance, the browser wallet
 * connection, every linked wallet (switch primary) and linking a new one, so
 * wallets are never buried in Settings.
 */
export function WalletMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const primary = me.wallets.find((w) => w.is_primary) ?? me.wallets[0];
  const balance = useBalance(Boolean(primary));
  const qc = useQueryClient();
  const m = useWalletMutations();
  const browser = useWallet();
  const browserAddr = browser.publicKey?.toBase58() ?? null;
  const browserLinked = browserAddr ? me.wallets.some((w) => w.address === browserAddr) : false;
  const showLink = adding || me.wallets.length === 0;

  // Wallets linked before we saved the app name: learn it the first time that wallet connects.
  const labelled = useRef(new Set<string>());
  const unnamed = me.wallets.find((w) => w.address === browserAddr && w.kind === "EXTERNAL" && !w.provider);
  const providerName = browser.wallet?.adapter.name;
  useEffect(() => {
    if (!unnamed || !providerName || labelled.current.has(unnamed.address)) return;
    labelled.current.add(unnamed.address);
    m.label.mutate({ address: unnamed.address, provider: providerName });
  }, [unnamed, providerName, m.label]);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setAdding(false);
      }}
    >
      <SheetTrigger asChild>
        {primary ? (
          <button
            type="button"
            aria-label="Wallets"
            className="glass flex h-10 min-w-0 items-center gap-2 rounded-full pl-3 pr-2.5 transition hover:bg-white/[0.06] active:scale-[0.98] sm:gap-3 sm:pl-1.5 sm:pr-3"
          >
            <span className="hidden h-7 items-center rounded-full bg-white/10 px-2.5 text-[12px] text-ink-2 sm:inline-flex">cUSD</span>
            <span className="num text-[14px] text-ink">
              {balance.data ? usd(balance.data.cusd, "exact") : balance.isPending ? <Skeleton className="inline-block h-3 w-16" /> : "—"}
            </span>
            <span className="hidden h-4 w-px bg-line-strong sm:block" />
            <span className="hidden items-center gap-1.5 font-mono text-[12.5px] text-ink-2 sm:inline-flex">
              {browser.connected && browser.wallet && <img src={browser.wallet.adapter.icon} alt="" className="size-4 rounded" />}
              {short(primary.address, 4, 4)}
            </span>
            <ChevronDown className="size-3.5 text-ink-3" />
          </button>
        ) : (
          <Button size="sm" variant="white" icon={<WalletIcon className="size-4" />}>
            Connect wallet
          </Button>
        )}
      </SheetTrigger>
      <SheetContent title="Wallets" description="Credent pays every network fee. Your primary wallet receives drawdowns, withdrawals and test cUSD.">
        <div className="space-y-6 p-5">
          {primary && (
            <div className="rounded-[20px] border border-line-strong bg-white/[0.03] p-4">
              <div className="text-[12.5px] text-ink-3">Primary wallet balance</div>
              <div className="num mt-1 text-[28px] text-ink">
                {balance.data ? usd(balance.data.cusd, "exact") : <Skeleton className="h-7 w-28" />}
                <span className="ml-1.5 text-[13px] text-ink-3">cUSD</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <Address value={primary.address} head={6} tail={6} />
                <FaucetButton size="sm" />
              </div>
            </div>
          )}

          <section>
            <h3 className="mb-2 text-[13px] text-ink-3">Browser wallet</h3>
            {browser.connected && browserAddr ? (
              <div className="flex items-center gap-3 rounded-[16px] border border-line p-3">
                {browser.wallet && <img src={browser.wallet.adapter.icon} alt="" className="size-8 rounded-lg" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] text-ink">{browser.wallet?.adapter.name}</div>
                  <div className="font-mono text-[12px] text-ink-3">
                    {short(browserAddr, 4, 4)} · {browserLinked ? "linked" : "not linked yet"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => browser.disconnect()}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <p className="rounded-[16px] border border-dashed border-line p-3 text-[13px] text-ink-3">
                No browser wallet connected. You&apos;ll be asked to connect when something needs your signature.
              </p>
            )}
            {browser.connected && browserAddr && !browserLinked && !showLink && (
              <Button size="sm" className="mt-2" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
                Link {short(browserAddr, 4, 4)}
              </Button>
            )}
          </section>

          {me.wallets.length > 0 && (
            <section>
              <h3 className="mb-2 text-[13px] text-ink-3">Linked wallets</h3>
              <ul className="space-y-2">
                {me.wallets.map((w) => (
                  <li
                    key={w.address}
                    className={cn(
                      "flex items-center gap-3 rounded-[16px] border p-3",
                      w.is_primary ? "border-line-strong bg-white/[0.03]" : "border-line",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <WalletIdentity wallet={w} head={4} tail={4} />
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                        {w.is_primary && <StatusPill tone="public">Primary</StatusPill>}
                        <StatusPill tone={w.kind === "CUSTODIAL" ? "private" : "neutral"} icon={false}>
                          {w.kind === "CUSTODIAL" ? "Custodial" : "Self-custody"}
                        </StatusPill>
                        {w.address === browserAddr && <StatusPill tone="neutral" icon={false}>Connected</StatusPill>}
                      </div>
                    </div>
                    {!w.is_primary && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Star className="size-3.5" />}
                        busy={m.makePrimary.isPending && m.makePrimary.variables === w.address}
                        onClick={() =>
                          m.makePrimary.mutate(w.address, {
                            onSuccess: () => {
                              qc.invalidateQueries({ queryKey: qk.balance });
                              toast.success("Primary wallet changed");
                            },
                            onError: (e) => toast.error(errorMessage(e)),
                          })
                        }
                      >
                        Make primary
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showLink ? (
            <section>
              <h3 className="mb-3 text-[13px] text-ink-3">Link a wallet</h3>
              <WalletLink
                allowCustodial={!me.wallets.some((w) => w.kind === "CUSTODIAL")}
                onLinked={() => {
                  setAdding(false);
                  qc.invalidateQueries({ queryKey: qk.balance });
                  toast.success("Wallet linked");
                }}
              />
            </section>
          ) : (
            <Button className="w-full" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
              Link another wallet
            </Button>
          )}

          <Link
            href="/app/settings/wallets"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 transition hover:text-ink"
          >
            <Settings className="size-3.5" /> Remove wallets in Settings
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
