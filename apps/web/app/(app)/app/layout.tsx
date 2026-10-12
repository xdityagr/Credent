import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import { SolanaWalletProvider } from "@/components/wallet-provider";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Credent" } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
      <AppShell>{children}</AppShell>
    </SolanaWalletProvider>
  );
}
