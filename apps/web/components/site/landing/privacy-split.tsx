"use client";

import { Eye, EyeOff } from "lucide-react";
import { Redacted } from "@/components/ui";

const PUBLIC_ROWS: [string, string][] = [
  ["Borrower", "BRW-7F3A"],
  ["Proven claim", "90-day revenue ≥ $240,000"],
  ["Principal", "$60,000 at 16.0% APR"],
  ["Installments", "Week 5 of 12 paid in full"],
  ["Tranche losses", "None"],
];

const PRIVATE_ROWS: [string, string, string][] = [
  ["Company name", "Juniper Ceramics Ltd", "12ch"],
  ["Exact 90-day revenue", "$318,406.22", "9ch"],
  ["Daily sales", "$3,540 avg, 41 days > $3k", "14ch"],
  ["Customers", "1,284 card payments", "11ch"],
  ["Payout account", "•••• 4410", "7ch"],
];

export function PrivacySplit() {
  return (
    <section className="relative mx-auto max-w-[1280px] px-5 py-20 md:px-8 md:py-28">
      <div className="grid items-end gap-6 md:grid-cols-[1.2fr_1fr]">
        <h2 className="max-w-[15ch] font-serif text-[clamp(40px,5.4vw,72px)] leading-[0.98] tracking-[-0.03em] text-[#f4f1ee]">
          Lenders see the claim. <span className="italic text-ink-2">You keep the books.</span>
        </h2>
        <p className="max-w-[44ch] text-[16px] leading-relaxed text-ink-2 md:justify-self-end">
          The same loan, seen from both sides. On the right is your view as the business: press and hold a masked value to
          reveal it. Nobody else gets that option.
        </p>
      </div>

      <div className="mt-14 grid overflow-hidden rounded-[28px] border border-line md:grid-cols-2">
        <div className="relative bg-[linear-gradient(180deg,rgb(45_91_255/0.08),transparent_40%)] p-6 md:p-9">
          <div className="flex items-center gap-2 text-[13px] text-senior-text">
            <Eye className="size-4" /> Public, on the ledger
          </div>
          <dl className="mt-6 divide-y divide-line">
            {PUBLIC_ROWS.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] gap-4 py-3.5 text-[14.5px] md:grid-cols-[160px_1fr]">
                <dt className="text-ink-3">{k}</dt>
                <dd className="num text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative border-t border-line bg-[linear-gradient(180deg,rgb(255_138_61/0.07),transparent_40%)] p-6 md:border-l md:border-t-0 md:p-9">
          <div className="flex items-center gap-2 text-[13px] text-ember-1">
            <EyeOff className="size-4" /> Private, stays with the business
          </div>
          <dl className="mt-6 divide-y divide-line">
            {PRIVATE_ROWS.map(([k, v, w]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] items-center gap-4 py-3 text-[14.5px] md:grid-cols-[160px_1fr]">
                <dt className="text-ink-3">{k}</dt>
                <dd className="text-ink">
                  <Redacted canReveal label={k} width={w}>
                    <span className="num px-1">{v}</span>
                  </Redacted>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-[12.5px] text-ink-3">Example values. On Credent, only the business and its chosen pool manager see the company name.</p>
        </div>
      </div>
    </section>
  );
}
