"use client";

import { ArrowUpFromLine, BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RoleGate } from "@/components/app/kit";
import { MoneyInput, SectionPanel, Table, cents } from "@/components/app/portal";
import {
  Button,
  ButtonLink,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  PageHeader,
  Panel,
  Skeleton,
  Stat,
  toast,
} from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { pct, price, usd } from "@/lib/format";
import { type Position, useLenderActions, usePortfolio } from "@/lib/portal";

function WithdrawDialog({ pos, onClose }: { pos: Position; onClose: () => void }) {
  const a = useLenderActions();
  const [amount, setAmount] = useState("");
  const value = cents(amount);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={`Withdraw from ${pos.pool_name}`} description={`Your ${pos.tranche} position is worth ${usd(pos.value)}. Withdrawals are paid from the pool's idle cash.`}>
        <div className="space-y-4">
          <Field label="Amount" hint="Leave empty to withdraw everything.">
            <MoneyInput value={amount} onChange={setAmount} max={pos.value} placeholder={String(Math.floor(pos.value / 100))} />
          </Field>
          <Button
            variant="horizon"
            className="w-full"
            icon={<ArrowUpFromLine className="size-4" />}
            busy={a.withdraw.isPending}
            onClick={() =>
              a.withdraw.mutate(
                { pool_id: pos.pool_id, tranche: pos.tranche, amount: value },
                {
                  onSuccess: (r) => { toast.success(`${usd(r.amount)} is on its way to your wallet`); onClose(); },
                  onError: (e) => toast.error("Withdrawal failed", { description: errorMessage(e) }),
                },
              )
            }
          >
            Withdraw {value ? usd(value) : "all"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PortfolioPage() {
  const q = usePortfolio();
  const [withdrawing, setWithdrawing] = useState<Position | null>(null);
  const d = q.data;
  return (
    <RoleGate kind="LENDER">
      <div className="space-y-8">
        <PageHeader title="Portfolio" description="Your tranche positions across every pool, valued at today's share price." />
        {q.isPending ? (
          <Skeleton className="h-64 w-full rounded-[20px]" />
        ) : !d || d.positions.length === 0 ? (
          <EmptyState
            tone="horizon"
            icon={<BriefcaseBusiness />}
            title="No positions yet"
            body="Deposit into a pool's senior or junior tranche from the Funds page or a pool's page."
            action={<ButtonLink href="/app/funds" size="sm" variant="horizon">Go to funds</ButtonLink>}
          />
        ) : (
          <>
            <Panel className="grid grid-cols-2 gap-5 p-5 md:grid-cols-4 md:p-6">
              <Stat label="Positions value" value={<span className="num">{usd(d.deployed)}</span>} />
              <Stat label="Gain / loss" value={<span className={`num ${d.pnl < 0 ? "text-loss-text" : "text-junior-text"}`}>{d.pnl >= 0 ? "+" : ""}{usd(d.pnl, "exact")}</span>} />
              <Stat label="Wallet cUSD" value={<span className="num">{usd(d.wallet.cusd)}</span>} />
              <Stat label="Positions" value={d.positions.length} />
            </Panel>
            <SectionPanel title="Positions">
              <div className="-mx-5 md:-mx-6">
                <Table
                  rows={d.positions}
                  rowKey={(p) => `${p.pool_id}-${p.tranche}`}
                  columns={[
                    { key: "p", label: "Pool", render: (p) => <Link href={`/pools/${p.pool_slug}`} className="hover:underline">{p.pool_name}</Link> },
                    { key: "t", label: "Tranche", render: (p) => <span className="capitalize">{p.tranche}{p.coupon_bps ? `, ${pct(p.coupon_bps)} coupon` : ""}</span> },
                    { key: "sp", label: "Share price", align: "right", render: (p) => price(p.price_e6) },
                    { key: "d", label: "Deposited", align: "right", render: (p) => usd(p.deposited) },
                    { key: "v", label: "Value", align: "right", render: (p) => usd(p.value, "exact") },
                    { key: "g", label: "Gain / loss", align: "right", render: (p) => <span className={p.pnl < 0 ? "text-loss-text" : "text-junior-text"}>{p.pnl >= 0 ? "+" : ""}{usd(p.pnl, "exact")}</span> },
                    { key: "a", label: "", align: "right", render: (p) => <Button size="sm" variant="ghost" disabled={p.shares === 0} onClick={() => setWithdrawing(p)}>Withdraw</Button> },
                  ]}
                />
              </div>
            </SectionPanel>
          </>
        )}
        {withdrawing && <WithdrawDialog pos={withdrawing} onClose={() => setWithdrawing(null)} />}
      </div>
    </RoleGate>
  );
}
