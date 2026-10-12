"use client";

import Link from "next/link";
import { useState } from "react";
import { CapitalStack } from "@/components/CapitalStack";
import { EpochStrip } from "@/components/EpochStrip";
import { LedgerFeed } from "@/components/LedgerFeed";
import { NavChart } from "@/components/NavChart";
import { Waterfalls } from "@/components/Waterfall";
import { Button, Hash, Notice, Sheet, StatusTag } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { pct, usd } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { ChainVerify, NavPoint, PublicBlock, PublicEvent, PublicLoan, PublicPool, PublicStatus } from "@/lib/types";

const FILTERS: { key: string; label: string; types: string | null }[] = [
  { key: "all", label: "All", types: null },
  { key: "loans", label: "Loans", types: "LoanDrawn,InstallmentPaid,InstallmentShort,LoanLate,LoanDefaulted,LoanRepaid" },
  { key: "waterfall", label: "Waterfall", types: "InterestDistributed,LossAllocated,RecoveryAllocated" },
  { key: "proofs", label: "Proofs", types: "AttestationRecorded,ProofVerified,CreditLineOpened" },
  { key: "capital", label: "Deposits", types: "Deposit,PoolCreated" },
];

export default function ExplorerPage() {
  const { data: pool, error } = useApi<PublicPool>("/public/pool");
  const { data: loans } = useApi<PublicLoan[]>("/public/loans");
  const { data: nav } = useApi<NavPoint[]>("/public/tranches/history");
  const { data: lastInterest } = useApi<PublicEvent[]>("/public/ledger?limit=1&type=InterestDistributed");
  const { data: lastLoss } = useApi<PublicEvent[]>("/public/ledger?limit=1&type=LossAllocated");
  const { data: lastRecovery } = useApi<PublicEvent[]>("/public/ledger?limit=1&type=RecoveryAllocated");
  const [filter, setFilter] = useState(FILTERS[0]);
  const { data: events } = useApi<PublicEvent[]>(
    `/public/ledger?limit=60${filter.types ? `&type=${filter.types}` : ""}`,
  );

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[36px] font-extrabold tracking-[-0.035em] text-ink">The public book</h1>
          <p className="mt-2 max-w-[44rem] text-[17px] leading-relaxed text-ink-soft">
            Every loan, tranche balance, weekly settlement and loss, hash-chained and anchored to Solana. Borrower
            financials are not here, and never were.
          </p>
        </div>
        <ChainCheck />
      </div>

      {error && <Notice>{error}</Notice>}

      {pool && (
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr]">
          <Sheet className="p-6">
            <h2 className="mb-5 text-[20px] font-bold tracking-[-0.015em] text-ink">Capital stack</h2>
            <CapitalStack pool={pool} />
          </Sheet>
          <Sheet className="p-6">
            <h2 className="mb-5 text-[20px] font-bold tracking-[-0.015em] text-ink">Where the money went</h2>
            <Waterfalls interest={lastInterest?.[0]} loss={lastLoss?.[0]} recovery={lastRecovery?.[0]} />
            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-rule pt-5 text-[14px] sm:grid-cols-4">
              <Stat k="Interest to date" v={usd(pool.total_interest)} />
              <Stat k="Losses to date" v={usd(pool.total_losses)} tone={pool.total_losses ? "loss" : undefined} />
              <Stat k="Recovered" v={usd(pool.total_recovered)} />
              <Stat k="Protocol treasury" v={usd(pool.treasury)} />
            </dl>
          </Sheet>
        </div>
      )}

      <Sheet className="p-6">
        <h2 className="mb-1 text-[20px] font-bold tracking-[-0.015em] text-ink">Tranche share prices</h2>
        <p className="mb-5 text-[14px] text-ink-faint">Indexed to 1.0000 at launch. Junior rises faster and falls first.</p>
        <NavChart points={nav ?? []} />
      </Sheet>

      <section>
        <h2 className="mb-4 text-[24px] font-bold tracking-[-0.02em] text-ink">Loan book</h2>
        <LoanBook loans={loans ?? []} />
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[24px] font-bold tracking-[-0.02em] text-ink">Ledger</h2>
            <div className="flex flex-wrap gap-1" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter.key === f.key}
                  onClick={() => setFilter(f)}
                  className={`rounded-[4px] px-2.5 py-1 text-[14px] font-semibold ${
                    filter.key === f.key ? "bg-ink text-sheet" : "text-ink-soft hover:bg-paper-deep"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ledger-sheet rounded-[6px] border border-rule px-4">
            <LedgerFeed events={events ?? []} />
          </div>
        </section>
        <Blocks />
      </div>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "loss" }) {
  return (
    <div>
      <dt className="text-ink-faint">{k}</dt>
      <dd className={`mt-0.5 text-[17px] font-semibold tabular-nums ${tone === "loss" ? "text-loss" : "text-ink"}`}>{v}</dd>
    </div>
  );
}

function LoanBook({ loans }: { loans: PublicLoan[] }) {
  if (loans.length === 0) return <p className="text-[15px] text-ink-faint">No loans have been drawn yet.</p>;
  return (
    <div className="overflow-x-auto rounded-[6px] border border-rule bg-sheet">
      <table className="w-full min-w-[920px] text-[15px] tabular-nums">
        <thead className="border-b border-rule bg-paper-deep/60 text-left text-[13px] text-ink-soft">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Loan</th>
            <th className="px-4 py-2.5 font-semibold">Borrower</th>
            <th className="px-4 py-2.5 font-semibold">Proven revenue</th>
            <th className="px-4 py-2.5 text-right font-semibold">Principal</th>
            <th className="px-4 py-2.5 text-right font-semibold">Outstanding</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 font-semibold">12 weekly installments</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((l) => (
            <tr key={l.id} className="border-t border-rule align-middle">
              <td className="px-4 py-3 font-semibold text-ink">{l.id}</td>
              <td className="px-4 py-3 font-mono text-[13px] text-ink-soft">{l.borrower}</td>
              <td className="px-4 py-3">
                {l.proof_id ? (
                  <Link href={`/proof/${l.proof_id}`} className="text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink">
                    ≥ {usd(l.threshold ?? 0, "compact")} in 90d
                  </Link>
                ) : (
                  "–"
                )}
              </td>
              <td className="px-4 py-3 text-right text-ink">{usd(l.principal)}</td>
              <td className={`px-4 py-3 text-right ${l.status === "DEFAULTED" ? "text-loss line-through decoration-loss/50" : "text-ink"}`}>
                {usd(l.outstanding)}
                {l.arrears > 0 && l.status !== "DEFAULTED" && (
                  <span className="block text-[12px] text-warn">{usd(l.arrears)} in arrears</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusTag status={l.status} />
              </td>
              <td className="px-4 py-3">
                <EpochStrip history={l.history} epochs={l.epochs} />
                <span className="mt-1 block text-[12px] text-ink-faint">
                  {usd(l.installment)} per week at {pct(l.apr_bps, 0)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChainCheck() {
  const [result, setResult] = useState<ChainVerify | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="quiet"
        busy={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            setResult(await api<ChainVerify>("/public/ledger/verify"));
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Verify the entire chain
      </Button>
      {result &&
        (result.ok ? (
          <span className="text-[14px] text-junior">
            All {result.events} entries and {result.blocks} block roots recomputed and match.
          </span>
        ) : (
          <span className="text-[14px] font-semibold text-loss">Chain broken at entry #{result.bad_seq}.</span>
        ))}
      {error && <span className="text-[14px] text-loss">{error}</span>}
    </div>
  );
}

function Blocks() {
  const { data: blocks } = useApi<PublicBlock[]>("/public/blocks");
  const { data: status } = useApi<PublicStatus>("/public/status");
  const anchored = (blocks ?? []).filter((b) => b.anchor_status === "ANCHORED").length;
  return (
    <section>
      <h2 className="mb-3 text-[24px] font-bold tracking-[-0.02em] text-ink">Blocks on Solana</h2>
      {status && (
        <div className="mb-4 text-[14px] leading-relaxed text-ink-soft">
          {status.anchor.enabled ? (
            <>
              Each block&apos;s Merkle root is written to devnet as a memo from{" "}
              <Hash value={status.anchor.address} head={6} tail={6} />. {anchored} of {(blocks ?? []).length} anchored.
              {status.anchor.last_error && (
                <span className="mt-2 block rounded-[4px] border border-warn/40 bg-warn-soft px-3 py-2 text-warn">
                  Anchoring paused: devnet refused the last request. Fund the address above at{" "}
                  <a className="underline" href="https://faucet.solana.com" target="_blank" rel="noreferrer">
                    faucet.solana.com
                  </a>{" "}
                  and pending blocks will be anchored automatically.
                </span>
              )}
            </>
          ) : (
            "Anchoring is turned off for this deployment (ANCHOR_ENABLED=false)."
          )}
        </div>
      )}
      <ol className="divide-y divide-rule rounded-[6px] border border-rule bg-sheet">
        {(blocks ?? []).slice(0, 12).map((b) => (
          <li key={b.n} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[14px]">
            <span className="font-semibold text-ink">Block {b.n}</span>
            <span className="text-ink-faint">
              #{b.first_seq}–{b.last_seq}, day {b.day}
            </span>
            <Hash value={b.merkle_root} head={8} tail={4} />
            {b.anchor_url ? (
              <a href={b.anchor_url} target="_blank" rel="noreferrer" className="font-semibold text-junior underline-offset-2 hover:underline">
                Anchored
              </a>
            ) : (
              <span className={b.anchor_status === "UNANCHORED" ? "text-warn" : "text-ink-faint"}>
                {b.anchor_status.charAt(0) + b.anchor_status.slice(1).toLowerCase()}
              </span>
            )}
          </li>
        ))}
        {(blocks ?? []).length === 0 && <li className="px-4 py-4 text-[15px] text-ink-faint">No blocks sealed yet.</li>}
      </ol>
    </section>
  );
}
