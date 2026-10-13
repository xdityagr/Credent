"use client";

/* eslint-disable @next/next/no-img-element -- wallet adapter icons are data URLs */
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { ExternalLink, KeyRound, ShieldCheck, Wallet as WalletIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, toast } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { short } from "@/lib/format";
import { useWalletMutations } from "@/lib/queries";
import type { Wallet } from "@/lib/types";

const INSTALL: Record<string, string> = {
  Phantom: "https://phantom.app/download",
  Solflare: "https://solflare.com/download",
};

/**
 * Link a wallet to the organisation: connect Phantom/Solflare and sign the
 * server's challenge (no transaction, no fee), or create a custodial wallet.
 */
export function WalletLink({ onLinked, allowCustodial = true }: { onLinked?: (w: Wallet) => void; allowCustodial?: boolean }) {
  const { wallets, wallet, select, connect, connected, connecting, publicKey, signMessage, disconnect } = useWallet();
  const m = useWalletMutations();
  const [target, setTarget] = useState<WalletName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  // after select() the adapter swaps in; connect once it's the one we asked for
  useEffect(() => {
    if (!target || wallet?.adapter.name !== target || connected || connecting) return;
    connect().catch((e) => {
      setError(errorMessage(e) || "The wallet didn't connect.");
      setTarget(null);
    });
  }, [target, wallet, connected, connecting, connect]);

  const address = publicKey?.toBase58() ?? null;

  const sign = async () => {
    if (!address || !signMessage) {
      setError("This wallet can't sign messages. Try Phantom or Solflare.");
      return;
    }
    setError(null);
    setSigning(true);
    try {
      const { message } = await m.challenge.mutateAsync(address);
      const sig = await signMessage(new TextEncoder().encode(message));
      const w = await m.verify.mutateAsync({ address, signature: bs58.encode(sig), provider: wallet?.adapter.name });
      toast.success("Wallet linked", { description: short(w.address, 6, 6) });
      onLinked?.(w);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSigning(false);
    }
  };

  const custodial = async () => {
    setError(null);
    try {
      const w = await m.custodial.mutateAsync();
      toast.success("Custodial wallet created", { description: short(w.address, 6, 6) });
      onLinked?.(w);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const detected = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
  );
  const missing = Object.keys(INSTALL).filter((name) => !detected.some((w) => w.adapter.name === name));

  return (
    <div className="space-y-4">
      {connected && address ? (
        <div className="rounded-[20px] border border-horizon-2/30 bg-horizon-1/[0.06] p-5">
          <div className="flex items-center gap-3">
            {wallet?.adapter.icon && <img src={wallet.adapter.icon} alt="" className="size-8 rounded-lg" />}
            <div className="min-w-0">
              <div className="text-[14px] text-ink">{wallet?.adapter.name} connected</div>
              <div className="font-mono text-[12.5px] text-ink-2">{short(address, 6, 6)}</div>
            </div>
            <button type="button" onClick={() => disconnect().then(() => setTarget(null))} className="ml-auto text-[13px] text-ink-3 hover:text-ink">
              Use another
            </button>
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">
            Sign a one-time message to prove you own this address. It isn&apos;t a transaction and costs nothing.
          </p>
          <Button variant="horizon" className="mt-4 w-full" busy={signing} icon={<KeyRound className="size-4" />} onClick={sign}>
            Sign and link wallet
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {detected.map((w) => {
            const busy = connecting && target === w.adapter.name;
            return (
              <button
                key={w.adapter.name}
                type="button"
                disabled={connecting}
                onClick={() => {
                  setError(null);
                  setTarget(w.adapter.name);
                  select(w.adapter.name);
                }}
                className="group flex items-center gap-3 rounded-[18px] border border-line-strong bg-white/[0.03] p-4 text-left transition hover:border-horizon-2/50 hover:bg-white/[0.05] active:scale-[0.98] disabled:opacity-60"
              >
                <img src={w.adapter.icon} alt="" className="size-9 shrink-0 rounded-xl" />
                <span>
                  <span className="block text-[15px] text-ink">{w.adapter.name}</span>
                  <span className="block text-[12.5px] text-ink-3">{busy ? "Waiting for the wallet…" : "Detected in this browser"}</span>
                </span>
              </button>
            );
          })}
          {missing.map((name) => (
            <a
              key={name}
              href={INSTALL[name]}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-[18px] border border-line bg-transparent p-4 text-left opacity-80 transition hover:opacity-100"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[15px] text-ink-2">{name[0]}</span>
              <span className="min-w-0">
                <span className="block text-[15px] text-ink">{name}</span>
                <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-3">
                  Not detected · Get it <ExternalLink className="size-3" />
                </span>
              </span>
            </a>
          ))}
        </div>
      )}

      {allowCustodial && !connected && (
        <>
          <div className="flex items-center gap-3 text-[12.5px] text-ink-3">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={custodial}
            disabled={m.custodial.isPending}
            className={cn(
              "flex w-full items-center gap-4 rounded-[18px] border border-line-strong bg-white/[0.03] p-4 text-left transition hover:border-ember-1/50 hover:bg-white/[0.05] active:scale-[0.98] disabled:opacity-60",
            )}
          >
            <span className="glass inline-flex size-9 items-center justify-center rounded-xl text-ember-1">
              {m.custodial.isPending ? <WalletIcon className="size-4 animate-pulse" /> : <ShieldCheck className="size-4" />}
            </span>
            <span>
              <span className="block text-[15px] text-ink">{m.custodial.isPending ? "Creating your wallet…" : "Create a Credent custodial wallet"}</span>
              <span className="block text-[12.5px] text-ink-3">No extension needed. Credent holds the key and signs on your instruction.</span>
            </span>
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-[13.5px] text-loss-text">
          {error}
        </p>
      )}
    </div>
  );
}
