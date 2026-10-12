"use client";

import { ArrowDownToLine } from "lucide-react";
import { useState } from "react";
import { FaucetButton, RoleGate } from "@/components/app/kit";
import { DepositDialog, SectionPanel, Table } from "@/components/app/portal";
import { usePrimaryWallet } from "@/components/app/signing";
import { Address, BigAmount, Button, Panel, PageHeader, PoolStatusPill, Skeleton, StatusPill, TxLink } from "@/components/ui";
import { date, pct, usd } from "@/lib/format";
import { useBalance, usePools } from "@/lib/queries";
import { useTransfers } from "@/lib/portal";
import type { PublicPool } from "@/lib/types";

const KIND: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  FAUCET: "Test cUSD",
  DRAWDOWN: "Loan drawdown",
  OPERATING_PAYOUT: "Operating payout",
  DEPOSIT_REFUND: "Deposit refund",
};

export default function FundsPage() {
  const wallet = usePrimaryWallet();
  const balance = useBalance(Boolean(wallet));
  const pools = usePools();
  const transfers = useTransfers();
  const [target, setTarget] = useState<PublicPool | null>(null);
  const open = (pools.data ?? []).filter((p) => p.status === "OPEN" || p.status === "FUNDING");
  return (
    <RoleGate kind="LENDER">
      <div className="space-y-8">
        <PageHeader title="Funds" description="Move cUSD between your wallet and pool vaults. Every movement is a Solana transaction; Credent pays the fees." />
        <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <Panel className="p-5 md:p-6">
            <div className="text-[13px] text-ink-3">Wallet balance</div>
            <div className="mt-3 min-h-[56px]">{balance.isPending ? <Skeleton className="h-12 w-48" /> : <BigAmount cents={balance.data?.cusd ?? null} size="lg" />}</div>
            {wallet && <div className="mt-2 text-[13px] text-ink-3">In <Address value={wallet.address} /> ({wallet.kind === "CUSTODIAL" ? "custodial" : "your wallet"})</div>}
            <div className="mt-5"><FaucetButton /></div>
          </Panel>
          <SectionPanel title="Deposit into a pool" description="Senior earns a fixed coupon and is paid first. Junior earns the residual and takes losses first.">
            {pools.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : open.length === 0 ? (
              <p className="text-[14px] text-ink-3">No pools are taking deposits right now.</p>
            ) : (
              <ul className="divide-y divide-line">
                {open.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="flex items-center gap-2 text-[14.5px] text-ink">{p.name} <PoolStatusPill status={p.status} /></div>
                      <div className="text-[12.5px] text-ink-3">
                        Senior {pct(p.senior.coupon_bps)} fixed, room {usd(p.subordination_room)} · by {p.manager.name}
                      </div>
                    </div>
                    <Button size="sm" variant="horizon" icon={<ArrowDownToLine className="size-3.5" />} onClick={() => setTarget(p)}>Deposit</Button>
                  </li>
                ))}
              </ul>
            )}
          </SectionPanel>
        </div>
        <SectionPanel title="Transfers" description="Your on-chain history.">
          <div className="-mx-5 md:-mx-6">
            {transfers.isPending ? (
              <Skeleton className="mx-6 h-32" />
            ) : (
              <Table
                rows={transfers.data ?? []}
                rowKey={(t) => `${t.kind}-${t.id}`}
                empty={<p className="px-6 text-[14px] text-ink-3">No transfers yet. Get test cUSD to start.</p>}
                columns={[
                  { key: "k", label: "Type", render: (t) => <span>{KIND[t.kind] ?? t.kind}{t.pool ? <span className="text-ink-3"> to {t.pool} ({t.tranche})</span> : null}</span> },
                  { key: "a", label: "Amount", align: "right", render: (t) => usd(t.amount) },
                  { key: "s", label: "Status", render: (t) => <StatusPill tone={t.status === "CONFIRMED" ? "good" : t.status === "FAILED" || t.status === "EXPIRED" ? "loss" : "pending"}>{t.status.toLowerCase()}</StatusPill> },
                  { key: "d", label: "Date", render: (t) => date(t.created_at) },
                  { key: "x", label: "Transaction", render: (t) => <TxLink signature={t.signature} href={t.explorer_url} /> },
                ]}
              />
            )}
          </div>
        </SectionPanel>
        {target && <DepositDialog pool={target} open onOpenChange={(v) => !v && setTarget(null)} />}
      </div>
    </RoleGate>
  );
}
