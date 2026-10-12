"use client";

import { useState } from "react";
import { describe, toneDot, toneText } from "@/lib/events";
import type { PublicEvent } from "@/lib/types";
import { Hash } from "./ui";

/** Public ledger rows: seq, day, plain-language entry, and the hash link to the previous row. */
export function LedgerFeed({
  events,
  compact = false,
  emptyText = "No ledger entries yet.",
}: {
  events: PublicEvent[];
  compact?: boolean;
  emptyText?: string;
}) {
  // Rows newer than what was on screen at first render get a one-time highlight.
  const [baseline, setBaseline] = useState<number | null>(null);
  const newest = events.reduce((m, e) => Math.max(m, e.seq), 0);
  if (baseline === null && events.length > 0) setBaseline(newest); // adjust state during render
  const isFresh = (seq: number) => baseline !== null && seq > baseline;

  if (events.length === 0) return <p className="py-6 text-[15px] text-ink-faint">{emptyText}</p>;

  return (
    <ol className="divide-y divide-rule">
      {events.map((e) => {
        const [text, tone] = describe(e);
        return (
          <li
            key={e.seq}
            className={`grid grid-cols-[52px_1fr] gap-x-3 py-2.5 ${compact ? "" : "md:grid-cols-[60px_64px_1fr_auto]"} ${
              isFresh(e.seq) ? "row-new" : ""
            }`}
          >
            <span className="font-mono text-[13px] text-ink-faint">#{e.seq}</span>
            {!compact && <span className="hidden text-[13px] text-ink-faint md:block">day {e.day}</span>}
            <span className={`flex items-start gap-2 text-[15px] leading-snug ${toneText[tone]}`}>
              <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone]}`} />
              {text}
            </span>
            {!compact && (
              <span className="col-start-2 md:col-start-auto">
                <Hash value={e.hash} head={8} tail={0} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
