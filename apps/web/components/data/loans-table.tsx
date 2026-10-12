import Link from "next/link";
import { LoanStatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { pct, usd } from "@/lib/format";
import type { PublicLoan } from "@/lib/types";
import { EpochStrip } from "./epoch-strip";

/** The public loan book. Borrowers appear only as pseudonyms. */
export function LoansTable({ loans, className }: { loans: PublicLoan[]; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-[20px] border border-line", className)} data-lenis-prevent>
      <table className="w-full min-w-[880px] text-[14px]">
        <thead>
          <tr className="border-b border-line text-left text-[12.5px] text-ink-3">
            <th className="px-5 py-3 font-normal">Loan</th>
            <th className="px-5 py-3 font-normal">Borrower</th>
            <th className="px-5 py-3 font-normal">Proven revenue</th>
            <th className="px-5 py-3 text-right font-normal">Principal</th>
            <th className="px-5 py-3 text-right font-normal">Outstanding</th>
            <th className="px-5 py-3 font-normal">Status</th>
            <th className="px-5 py-3 font-normal">Weekly installments</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((l) => (
            <tr key={l.id} className="border-t border-line/60 align-middle transition-colors hover:bg-white/[0.02]">
              <td className="px-5 py-3.5 font-mono text-[12.5px] text-ink">{l.id}</td>
              <td className="px-5 py-3.5 font-mono text-[12.5px] text-ink-2">{l.borrower}</td>
              <td className="px-5 py-3.5">
                {l.proof_id ? (
                  <Link href={`/proofs/${l.proof_id}`} className="text-ink underline decoration-line-strong underline-offset-[3px] transition hover:decoration-ink-2">
                    ≥ {usd(l.threshold, "compact")} in 90 days
                  </Link>
                ) : (
                  <span className="text-ink-3">—</span>
                )}
              </td>
              <td className="num px-5 py-3.5 text-right text-ink">{usd(l.principal)}</td>
              <td className={cn("num px-5 py-3.5 text-right", l.status === "DEFAULTED" ? "text-loss-text line-through decoration-loss/50" : "text-ink")}>
                {usd(l.outstanding)}
                {l.arrears > 0 && l.status !== "DEFAULTED" && <span className="block text-[12px] text-warn">{usd(l.arrears)} in arrears</span>}
              </td>
              <td className="px-5 py-3.5">
                <LoanStatusPill status={l.status} />
              </td>
              <td className="px-5 py-3.5">
                <EpochStrip history={l.history} epochs={l.epochs} />
                <span className="mt-1.5 block text-[12px] text-ink-3">
                  {usd(l.installment)} a week at {pct(l.apr_bps, 0)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
