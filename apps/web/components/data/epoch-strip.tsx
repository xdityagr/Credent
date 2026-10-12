import { cn } from "@/lib/cn";
import { usd } from "@/lib/format";
import type { PublicEpoch } from "@/lib/types";

/** One cell per weekly installment: paid, short, or still to come. */
export function EpochStrip({ history, epochs, className }: { history: PublicEpoch[]; epochs: number; className?: string }) {
  return (
    <div className={cn("flex gap-[2px]", className)} role="img" aria-label={`${history.filter((h) => h.event === "InstallmentPaid").length} of ${epochs} installments paid in full`}>
      {Array.from({ length: epochs }, (_, i) => {
        const h = history.find((x) => x.epoch === i);
        const cls = !h ? "bg-white/[0.07]" : h.event === "InstallmentPaid" ? "bg-junior" : h.paid > 0 ? "bg-warn" : "loss-hatch";
        return (
          <span
            key={i}
            className={cn("h-3.5 w-2.5 rounded-[2px]", cls)}
            title={h ? `Week ${i + 1}: paid ${usd(h.paid)} of ${usd(h.due)}` : `Week ${i + 1}: upcoming`}
          />
        );
      })}
    </div>
  );
}
