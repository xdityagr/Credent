"use client";

import Link from "next/link";
import { CapitalStack } from "@/components/CapitalStack";
import { Envelope } from "@/components/Envelope";
import { LedgerFeed } from "@/components/LedgerFeed";
import { Notice } from "@/components/ui";
import { pct, usd } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { PublicEvent, PublicPool, PublicStatus } from "@/lib/types";

export default function Home() {
  const { data: pool, error } = useApi<PublicPool>("/public/pool");
  const { data: events } = useApi<PublicEvent[]>("/public/ledger?limit=7");
  const { data: status } = useApi<PublicStatus>("/public/status");

  return (
    <div className="space-y-20">
      <section className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div className="pt-4">
          <h1 className="text-[clamp(44px,7vw,84px)] font-extrabold leading-[0.95] tracking-[-0.045em] text-ink">
            Private credit,
            <br />
            public book.
          </h1>
          <p className="mt-7 max-w-[34rem] text-[19px] leading-[1.55] text-ink-soft">
            Businesses borrow against revenue they prove with a zero-knowledge proof, and repay straight
            from incoming customer payments. Lenders can audit every loan, tranche and loss. Nobody sees
            the borrower&apos;s books.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/borrow" className="rounded-[4px] bg-ink px-5 py-3 text-[16px] font-semibold text-sheet hover:bg-[#2a3d5f]">
              Borrow against revenue
            </Link>
            <Link href="/lend" className="rounded-[4px] border border-rule-strong px-5 py-3 text-[16px] font-semibold text-ink hover:bg-paper-deep">
              Lend to the pool
            </Link>
            <Link href="/explorer" className="rounded-[4px] px-5 py-3 text-[16px] font-semibold text-ink-soft hover:text-ink">
              Audit the book
            </Link>
          </div>
          {pool && (
            <p className="mt-10 max-w-[36rem] text-[16px] leading-relaxed text-ink-soft">
              Right now the pool holds <Strong>{usd(pool.total_nav)}</Strong> with{" "}
              <Strong>{usd(pool.outstanding)}</Strong> lent out ({pct(pool.utilization_bps, 0)} utilized) across{" "}
              <Strong>{pool.loans_active + pool.loans_late}</Strong> open loans.{" "}
              {pool.total_losses > 0 ? (
                <>
                  Defaults have cost <span className="font-semibold text-loss">{usd(pool.total_losses)}</span>, absorbed by
                  junior first.
                </>
              ) : (
                <>No defaults so far.</>
              )}
            </p>
          )}
          {error && (
            <div className="mt-8 max-w-[36rem]">
              <Notice>{error}</Notice>
            </div>
          )}
          {status && !status.seeded && (
            <div className="mt-8 max-w-[36rem]">
              <Notice kind="info">
                {status.seeding
                  ? "Seeding the demo world: generating three zero-knowledge proofs."
                  : status.seed_error ?? "The demo world is empty. Use Reset world in the simulation bar."}
              </Notice>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-[14px] text-ink-faint">The same loan, seen by a lender</p>
          <Envelope
            owner={false}
            label="Borrower's revenue statement"
            publicNote="90 days of daily revenue, sealed. Lenders get a commitment and a proof that the total clears the threshold."
          >
            {null}
          </Envelope>
          <div className="ledger-sheet rounded-[6px] border border-rule px-5 py-2">
            <div className="flex items-center justify-between border-b border-rule py-2 text-[14px]">
              <span className="font-semibold text-ink">Public ledger</span>
              <Link href="/explorer" className="font-semibold text-ink-soft hover:text-ink">
                Full ledger
              </Link>
            </div>
            <LedgerFeed events={events ?? []} compact emptyText="Waiting for the first entries." />
          </div>
        </div>
      </section>

      {pool && (
        <section className="grid gap-12 border-t border-rule pt-14 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="text-[30px] font-bold tracking-[-0.025em] text-ink">Who takes the first loss is public</h2>
            <p className="mt-3 max-w-[30rem] text-[17px] leading-relaxed text-ink-soft">
              Junior lenders earn the residual yield and absorb defaults first. Senior lenders earn a fixed
              coupon and are paid first. The split, every loss and every recovery are on the ledger.
            </p>
            <div className="mt-8">
              <CapitalStack pool={pool} height={300} />
            </div>
          </div>
          <div>
            <h2 className="text-[30px] font-bold tracking-[-0.025em] text-ink">How a loan moves</h2>
            <ol className="mt-6 space-y-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[36px_1fr] gap-x-3">
                  <span className="pt-0.5 text-[15px] font-semibold tabular-nums text-ink-faint">{i + 1}</span>
                  <div>
                    <h3 className="text-[18px] font-semibold text-ink">{s.title}</h3>
                    <p className="mt-1 text-[16px] leading-relaxed text-ink-soft">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </div>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold tabular-nums text-ink">{children}</span>;
}

const STEPS = [
  {
    title: "Prove revenue without showing it",
    body: "Connect Stripe through a zkTLS notary or upload signed payment receipts. A Noir circuit proves 90-day revenue clears a threshold; only the threshold and a commitment go public.",
  },
  {
    title: "Draw a credit line",
    body: "The line is 40% of the proven threshold, repaid in 12 weekly installments. The loan, its terms and the proof it rests on are written to the ledger.",
  },
  {
    title: "Repay before you touch the money",
    body: "Customer payments land in a lockbox. Each one repays what is due first; the rest is released to the business. Lenders only ever see paid or short.",
  },
  {
    title: "Settle the waterfall every week",
    body: "Interest pays the protocol fee, then the senior coupon, then junior. Three short weeks is a default: junior absorbs the loss before senior.",
  },
];
