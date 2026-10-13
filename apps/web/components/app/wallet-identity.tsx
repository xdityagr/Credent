"use client";

/* eslint-disable @next/next/no-img-element -- wallet adapter icons are data URLs */
import { useWallet } from "@solana/wallet-adapter-react";
import { Address, Logo } from "@/components/ui";
import type { Wallet } from "@/lib/types";

/** Which app a linked wallet belongs to: the name saved when it was linked, or the connected wallet's. */
export function useWalletLabel(w: Wallet): { name: string; icon: string | null } {
  const { wallets, wallet, publicKey } = useWallet();
  if (w.kind === "CUSTODIAL") return { name: "Credent custodial", icon: null };
  const live = publicKey?.toBase58() === w.address ? wallet?.adapter.name : undefined;
  const name = w.provider || live || "External wallet";
  const icon = wallets.find((x) => x.adapter.name === name)?.adapter.icon ?? null;
  return { name, icon };
}

/** Wallet icon, app name and address, e.g. [Phantom icon] Phantom · 7ZAR…Khci. */
export function WalletIdentity({ wallet, head = 6, tail = 6 }: { wallet: Wallet; head?: number; tail?: number }) {
  const { name, icon } = useWalletLabel(wallet);
  return (
    <span className="flex min-w-0 items-center gap-3">
      {wallet.kind === "CUSTODIAL" ? (
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.04]">
          <Logo colour className="size-5" />
        </span>
      ) : icon ? (
        <img src={icon} alt="" className="size-9 shrink-0 rounded-xl" />
      ) : (
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[15px] text-ink-2">
          {name[0]}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[14.5px] text-ink">{name}</span>
        <Address value={wallet.address} head={head} tail={tail} className="text-[12.5px]" />
      </span>
    </span>
  );
}
