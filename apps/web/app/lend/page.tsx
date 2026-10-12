"use client";

import { useEffect, useState } from "react";
import { SignIn } from "@/components/SignIn";
import { Button, Field, Notice, Sheet, inputCls } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { pct, price, toCents, usd } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/useApi";
import type { LenderPositions, PublicPool, PublicTranche } from "@/lib/types";

export default function LendPage() {
  const { session, ready, signOut } = useSession();
  const { data: pool, error } = useApi<PublicPool>("/public/pool");
  const pos = useApi<LenderPositions>(session ? "/lender/positions" : null, session?.token);

  useEffect(() => {
    if (pos.code === "UNAUTHORIZED") signOut();
  }, [pos.code, signOut]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-[36px] font-extrabold tracking-[-0.035em] text-ink">Lend to the pool</h1>
        <p className="mt-2 max-w-[44rem] text-[17px] leading-relaxed text-ink-soft">
          Choose how much risk you hold. Every loan you&apos;re exposed to, its proof, and every payment status is
          on the public ledger, so you can audit before you deposit.
        </p>
      </div>

      {error && <Notice>{error}</Notice>}
      {pool && (
        <>
          <div className="grid gap-px overflow-hidden rounded-[6px] border border-rule bg-rule md:grid-cols-2">
            <TrancheColumn
              t={pool.senior}
              title="Senior"
              mark="bg-senior-mark"
              terms={[
                ["Yield", `${pct(pool.senior.coupon_bps ?? 0)} fixed coupon on deployed capital`],
                ["Paid", "first, before junior"],
                ["Losses", "only after junior is wiped out"],
              ]}
              session={session?.token ?? null}
              onDone={pos.refresh}
              maxNote={`Room left under the 4x cap: ${usd(pool.subordination_room)}`}
            />
            <TrancheColumn
              t={pool.junior}
              title="Junior"
              mark="bg-junior-mark"
              terms={[
                ["Yield", "everything left after the fee and the senior coupon"],
                ["Paid", "after senior"],
                ["Losses", "first; protects senior"],
              ]}
              session={session?.token ?? null}
              onDone={pos.refresh}
            />
          </div>
          <Subordination pool={pool} />
        </>
      )}

      {ready && !session && (
        <SignIn title="Sign in to deposit" body="Deposits use demo USDC from the faucet. No real funds move." />
      )}
      {session && pos.data && <Positions data={pos.data} token={session.token} onDone={pos.refresh} />}
    </div>
  );
}

function TrancheColumn({
  t,
  title,
  mark,
  terms,
  session,
  onDone,
  maxNote,
}: {
  t: PublicTranche;
  title: string;
  mark: string;
  terms: [string, string][];
  session: string | null;
  onDone: () => void;
  maxNote?: string;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const cents = toCents(amount);
  const change = t.price_e6 - 1_000_000;

  return (
    <div className="bg-sheet p-6">
      <div className="flex items-center gap-3">
        <span className={`h-4 w-4 rounded-[3px] ${mark}`} />
        <h2 className="text-[26px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-5">
        <div>
          <div className="text-[13px] text-ink-faint">Net asset value</div>
          <div className="text-[24px] font-semibold tabular-nums text-ink">{usd(t.nav)}</div>
        </div>
        <div>
          <div className="text-[13px] text-ink-faint">Share price</div>
          <div className="text-[24px] font-semibold tabular-nums text-ink">{price(t.price_e6)}</div>
          <div className={`text-[13px] tabular-nums ${change < 0 ? "text-loss" : "text-junior"}`}>
            {change >= 0 ? "+" : ""}
            {(change / 10_000).toFixed(2)}% since launch
          </div>
        </div>
      </div>
      <dl className="mt-5 space-y-1.5 text-[15px]">
        {terms.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[72px_1fr] gap-2">
            <dt className="text-ink-faint">{k}</dt>
            <dd className="text-ink">{v}</dd>
          </div>
        ))}
        {t.writedown > 0 && (
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <dt className="text-ink-faint">Written down</dt>
            <dd className="font-semibold text-loss">{usd(t.writedown)}</dd>
          </div>
        )}
        {t.coupon_arrears > 0 && (
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <dt className="text-ink-faint">Owed</dt>
            <dd className="text-warn">{usd(t.coupon_arrears)} coupon in arrears</dd>
          </div>
        )}
      </dl>

      {session && (
        <form
          className="mt-6 flex flex-wrap items-end gap-3 border-t border-rule pt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!cents) return;
            setBusy(true);
            setError(null);
            setOk(null);
            try {
              await api("/lender/deposit", { body: { tranche: t.name, amount: cents }, token: session });
              setOk(`Deposited ${usd(cents)} into ${title.toLowerCase()}.`);
              setAmount("");
              onDone();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="min-w-[180px] flex-1">
            <Field label={`Deposit into ${title.toLowerCase()}`} hint={maxNote}>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="50,000" className={inputCls} />
            </Field>
          </div>
          <Button busy={busy} disabled={!cents} variant={t.name === "junior" ? "junior" : "ink"}>
            Deposit
          </Button>
          {error && <div className="w-full"><Notice>{error}</Notice></div>}
          {ok && <div className="w-full"><Notice kind="ok">{ok}</Notice></div>}
        </form>
      )}
    </div>
  );
}

function Subordination({ pool }: { pool: PublicPool }) {
  const lev = pool.leverage_x100 / 100;
  const pctOfCap = Math.min(100, (lev / 4) * 100);
  return (
    <Sheet className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[18px] font-semibold text-ink">Subordination</h3>
        <span className="text-[15px] tabular-nums text-ink-soft">
          senior is {lev.toFixed(2)}x junior; the cap is 4.00x
        </span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-[3px] bg-paper-deep">
        <div className="h-full rounded-[3px] bg-senior-mark" style={{ width: `${pctOfCap}%` }} />
      </div>
      <p className="mt-3 max-w-[48rem] text-[15px] leading-relaxed text-ink-soft">
        Senior deposits that would push senior above four times junior are refused, so there is always at least 20% of first-loss
        capital beneath senior lenders. Pool utilization is {pct(pool.utilization_bps, 0)}.
      </p>
    </Sheet>
  );
}

function Positions({ data, token, onDone }: { data: LenderPositions; token: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-semibold text-ink">Your positions</h3>
          <p className="text-[15px] text-ink-soft">
            Wallet balance <span className="font-semibold tabular-nums text-ink">{usd(data.balance)}</span> demo USDC
          </p>
        </div>
        <Button
          variant="quiet"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api("/lender/faucet", { method: "POST", token });
              onDone();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Get $250,000 demo USDC
        </Button>
      </div>
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      {data.positions.length === 0 ? (
        <p className="mt-4 text-[15px] text-ink-faint">No deposits yet. Get demo USDC, then deposit into a tranche above.</p>
      ) : (
        <table className="mt-4 w-full text-[15px] tabular-nums">
          <thead className="text-left text-[13px] text-ink-faint">
            <tr>
              <th className="py-2 font-normal">Tranche</th>
              <th className="py-2 font-normal">Deposited</th>
              <th className="py-2 font-normal">Value now</th>
              <th className="py-2 font-normal">Gain / loss</th>
            </tr>
          </thead>
          <tbody>
            {data.positions.map((p) => (
              <tr key={p.tranche} className="border-t border-rule">
                <td className="py-2 font-semibold capitalize text-ink">{p.tranche}</td>
                <td className="py-2 text-ink">{usd(p.deposited)}</td>
                <td className="py-2 text-ink">{usd(p.value, "exact")}</td>
                <td className={`py-2 ${p.pnl < 0 ? "text-loss" : "text-junior"}`}>
                  {p.pnl >= 0 ? "+" : ""}
                  {usd(p.pnl, "exact")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Sheet>
  );
}
