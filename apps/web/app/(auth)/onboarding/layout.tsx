import type { Metadata } from "next";
import { SolanaWalletProvider } from "@/components/wallet-provider";

export const metadata: Metadata = { title: "Set up your company" };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
