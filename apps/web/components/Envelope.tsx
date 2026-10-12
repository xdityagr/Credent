"use client";

import { useState } from "react";

/**
 * Private data lives in a security envelope. Closed, it shows the bank-envelope
 * tint the way lenders see it; the owner can open it to read their own figures.
 */
export function Envelope({
  owner,
  label,
  publicNote,
  children,
  defaultOpen = false,
}: {
  owner: boolean;
  label: string;
  publicNote: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen && owner);

  if (open && owner) {
    return (
      <div className="relative rounded-[6px] border border-envelope/30 bg-sheet">
        <div className="flex items-center justify-between gap-3 border-b border-envelope/20 px-5 py-3">
          <div className="flex items-center gap-2 text-[14px] text-envelope">
            <Seal />
            <span className="font-semibold">{label}</span>
            <span className="text-ink-faint">Only you can see this</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-[14px] font-semibold text-envelope hover:underline">
            Seal
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    );
  }

  return (
    <div className="envelope-tint relative overflow-hidden rounded-[6px] border border-envelope/30">
      <div className="flex min-h-[140px] flex-col items-start justify-end gap-3 p-5">
        <div className="max-w-md rounded-[4px] bg-sheet/95 px-4 py-3 shadow-[0_1px_0_rgba(28,43,69,0.08)]">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-envelope">
            <Seal />
            {label}
          </div>
          <p className="mt-1 text-[14px] leading-snug text-ink-soft">{publicNote}</p>
          {owner && (
            <button
              onClick={() => setOpen(true)}
              className="mt-2 text-[14px] font-semibold text-envelope underline-offset-2 hover:underline"
            >
              Open envelope
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Seal() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0">
      <rect x="2" y="6" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
