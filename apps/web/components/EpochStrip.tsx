import { usd } from "@/lib/format";
import type { PublicEpoch } from "@/lib/types";

/** One cell per weekly installment: paid (filled, check) or short (hatched, cross); upcoming weeks are outlined. */
export function EpochStrip({ history, epochs }: { history: PublicEpoch[]; epochs: number }) {
  const cells = Array.from({ length: Math.max(epochs, history.length) }, (_, i) => history[i]);
  return (
    <div className="flex flex-wrap gap-[3px]" role="list" aria-label="Weekly installments">
      {cells.map((h, i) => {
        if (!h)
          return (
            <span key={i} role="listitem" title={`Week ${i + 1}: upcoming`} className="h-4 w-4 rounded-[2px] border border-rule-strong" />
          );
        const paid = h.event === "InstallmentPaid";
        return (
          <span
            key={i}
            role="listitem"
            title={`Week ${i + 1}: ${paid ? "paid" : "short"} ${usd(h.paid)} of ${usd(h.due)}`}
            className={`flex h-4 w-4 items-center justify-center rounded-[2px] text-[10px] font-bold leading-none ${
              paid ? "bg-junior-mark text-sheet" : "loss-hatch text-loss"
            }`}
          >
            {paid ? "✓" : "×"}
          </span>
        );
      })}
    </div>
  );
}
