"use client";

import type { WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { useCallback } from "react";
import { toast } from "sonner";

/**
 * Solana wallet context for onboarding and the app.
 *
 * No adapters are listed: Phantom, Solflare, Backpack and other current wallets
 * register themselves through the Wallet Standard, which is more reliable than
 * the legacy per-wallet adapters (those mis-detect installed wallets).
 * Wallet errors (rejected popup, locked wallet) are shown as toasts instead of
 * surfacing as unhandled console errors.
 */
export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const onError = useCallback((error: WalletError) => {
    const msg = error.message || error.name;
    const rejected = /reject|denied|cancel/i.test(msg);
    toast.error(rejected ? "Request cancelled in your wallet" : "Wallet error", {
      description: rejected ? "Nothing was signed." : `${msg}. Unlock your wallet and try again.`,
    });
  }, []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect={false} onError={onError}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
