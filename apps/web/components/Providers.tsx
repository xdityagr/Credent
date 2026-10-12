"use client";

import WalletProvider from "./WalletProvider";
import { SessionProvider } from "@/lib/session";
import { LiveProvider } from "@/lib/live";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <SessionProvider>
        <LiveProvider>{children}</LiveProvider>
      </SessionProvider>
    </WalletProvider>
  );
}
