"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { toCents, usd } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { PublicLoan, PublicStatus } from "@/lib/types";
import { Button, inputCls } from "./ui";

type Panel = null | "payment" | "default" | "recover";

/** Simulation controls. Everything here goes through the same sweep and waterfall code as real flows. */
export function DemoDock() {
  const { data: status } = useApi<PublicStatus>("/public/status");
  const { data: loans } = useApi<PublicLoan[]>("/public/loans");
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");

  if (status && !status.sim_enabled) return null;

  const live = (loans ?? []).filter((l) => l.status === "ACTIVE" || l.status === "LATE");
  const defaulted = (loans ?? []).filter((l) => l.status === "DEFAULTED");

  async function run(key: string, path: string, body?: unknown) {
    setBusy(key);
    setError(null);
    try {
      await api(path, { method: "POST", body });
      setPanel(null);
      setAmount("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function openPanel(p: Panel) {
    setPanel(panel === p ? null : p);
    setError(null);
    const pool = p === "recover" ? defaulted : live;
    setTarget(p === "payment" ? (pool[0]?.borrower ?? "") : (pool[0]?.id ?? ""));
  }

  const cents = toCents(amount);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/20 bg-ink text-sheet">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <div className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-2 py-2">
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex items-center gap-2 text-[14px] font-semibold"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-[#7fc4a3]" />
            Simulation
            <span className="font-normal text-sheet/60">
              {status ? `day ${status.day}, week ${Math.floor(status.day / 7)}` : "connecting"}
            </span>
          </button>
          {open && (
            <div className="flex flex-wrap items-center gap-1.5">
              <DockButton busy={busy === "d1"} onClick={() => run("d1", "/sim/advance", { days: 1 })}>
                +1 day
              </DockButton>
              <DockButton busy={busy === "w1"} onClick={() => run("w1", "/sim/advance", { days: 7 })}>
                +1 week
              </DockButton>
              <DockButton busy={busy === "w4"} onClick={() => run("w4", "/sim/advance", { days: 28 })}>
                +4 weeks
              </DockButton>
              <span className="mx-1 h-5 w-px bg-sheet/20" />
              <DockButton active={panel === "payment"} onClick={() => openPanel("payment")}>
                Customer payment
              </DockButton>
              <DockButton active={panel === "default"} onClick={() => openPanel("default")}>
                Default a loan
              </DockButton>
              <DockButton active={panel === "recover"} onClick={() => openPanel("recover")}>
                Recovery
              </DockButton>
              <span className="mx-1 h-5 w-px bg-sheet/20" />
              <DockButton
                busy={busy === "reset"}
                onClick={() => run("reset", "/sim/reset")}
                title="Wipe and reseed the demo world (generates 3 fresh ZK proofs)"
              >
                Reset world
              </DockButton>
            </div>
          )}
        </div>

        {open && panel && (
          <div className="flex flex-wrap items-end gap-3 border-t border-sheet/15 py-3 text-[14px]">
            <label className="flex flex-col gap-1">
              <span className="text-sheet/70">{panel === "payment" ? "Borrower" : "Loan"}</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="rounded-[4px] border border-sheet/30 bg-ink px-2 py-1.5 text-sheet"
              >
                {(panel === "recover" ? defaulted : live).map((l) => (
                  <option key={l.id} value={panel === "payment" ? l.borrower : l.id}>
                    {panel === "payment" ? `${l.borrower} (${l.id})` : `${l.id}, ${l.borrower}, ${usd(l.outstanding, "compact")} out`}
                  </option>
                ))}
              </select>
            </label>
            {panel !== "default" && (
              <label className="flex flex-col gap-1">
                <span className="text-sheet/70">Amount (USD)</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="25,000"
                  className={`${inputCls} !w-36 !border-sheet/30 !bg-ink !py-1.5 !text-sheet`}
                />
              </label>
            )}
            <Button
              variant={panel === "default" ? "loss" : "junior"}
              busy={busy === panel}
              disabled={!target || (panel !== "default" && !cents)}
              onClick={() => {
                if (panel === "payment") run("payment", "/sim/payment", { borrower: target, amount: cents });
                if (panel === "default") run("default", "/sim/default", { loan_id: target });
                if (panel === "recover") run("recover", "/sim/recover", { loan_id: target, amount: cents });
              }}
            >
              {panel === "payment" ? "Send payment" : panel === "default" ? "Default loan" : "Record recovery"}
            </Button>
            <span className="max-w-sm text-sheet/60">
              {panel === "payment" && "Lands in the borrower's lockbox. The sweep takes what's due first."}
              {panel === "default" && "Writes off the outstanding principal: junior absorbs it first."}
              {panel === "recover" && "Recovered cash restores senior first, then junior."}
              {(panel === "recover" ? defaulted : live).length === 0 && " No eligible loans right now."}
            </span>
          </div>
        )}
        {error && <div className="border-t border-sheet/15 py-2 text-[14px] text-[#f2a49b]">{error}</div>}
      </div>
    </div>
  );
}

function DockButton({
  children,
  busy,
  active,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; active?: boolean }) {
  return (
    <button
      {...rest}
      disabled={busy || rest.disabled}
      className={`rounded-[4px] px-2.5 py-1 text-[14px] font-semibold transition-colors disabled:opacity-60 ${
        active ? "bg-sheet text-ink" : "text-sheet hover:bg-sheet/10"
      }`}
    >
      {busy ? "Working…" : children}
    </button>
  );
}
