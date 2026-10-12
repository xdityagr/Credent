"use client";

import { AnimatePresence, motion } from "motion/react";
import { describe, toneDot } from "@/lib/events";
import { cn } from "@/lib/cn";
import { short } from "@/lib/format";
import type { PublicEvent } from "@/lib/types";
import { Skeleton } from "@/components/ui";

/** Public ledger rows. New rows slide in at the top. */
export function LedgerFeed({ events, className, compact = false }: { events: PublicEvent[]; className?: string; compact?: boolean }) {
  return (
    <ol className={cn("divide-y divide-line", className)}>
      <AnimatePresence initial={false}>
        {events.map((e) => {
          const [text, tone] = describe(e);
          return (
            <motion.li
              key={e.seq}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-[auto_1fr] items-start gap-x-3 py-3"
            >
              <span className={cn("mt-[7px] size-1.5 rounded-full", toneDot[tone])} aria-hidden />
              <div className="min-w-0">
                <p className="text-[14px] leading-snug text-ink">{text}</p>
                {!compact && (
                  <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11.5px] text-ink-3">
                    <span>#{e.seq}</span>
                    <span>day {e.day}</span>
                    <span title={e.hash}>{short(e.hash, 8, 4)}</span>
                    {e.block != null && <span>block {e.block}</span>}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

export function LedgerSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3 py-3.5">
          <Skeleton className="mt-1 size-1.5 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
            <Skeleton className="h-2.5 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}
