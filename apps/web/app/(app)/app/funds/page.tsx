"use client";

import { ArrowDownToLine, ArrowUpFromLine, Banknote } from "lucide-react";
import { FaucetButton, PlaceholderPage, RoleGate, WalletHero } from "@/components/app/kit";
import { ButtonLink, EmptyState, Panel, PanelHeader } from "@/components/ui";

export default function FundsPage() {
  return (
    <RoleGate kind="LENDER">
      <PlaceholderPage
        title="Funds"
        description="Move cUSD between your wallet and your tranche positions. Deposits are signed in your wallet; Credent pays the network fee."
        preview="none"
        actions={<FaucetButton variant="horizon" />}
        empty={
          <WalletHero
            label="Wallet balance"
            actions={[
              { href: "/pools", icon: <ArrowDownToLine />, label: "Deposit", sub: "Choose a pool and tranche" },
              { href: "/app/portfolio", icon: <ArrowUpFromLine />, label: "Withdraw", sub: "From available cash" },
              { href: "/app/settings/wallets", icon: <Banknote />, label: "Wallets", sub: "Primary and linked" },
              { href: "/docs#wallets", icon: <Banknote />, label: "Devnet setup", sub: "Phantom or Solflare" },
            ]}
          />
        }
      >
        <Panel>
          <PanelHeader title="Transfers" description="Deposits, withdrawals and faucet mints, with their Solana transactions." />
          <div className="p-5 md:p-6">
            <EmptyState
              tone="horizon"
              icon={<ArrowDownToLine />}
              title="No transfers yet"
              body="Get test cUSD from the faucet, then deposit into a pool's senior or junior tranche. Each transfer links to Solana Explorer."
              action={
                <ButtonLink href="/pools" size="sm" variant="horizon">
                  Find a pool
                </ButtonLink>
              }
            />
          </div>
        </Panel>
      </PlaceholderPage>
    </RoleGate>
  );
}
