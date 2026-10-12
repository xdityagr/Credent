"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownToLine, Check, FileCheck2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Cascade } from "@/components/data/waterfall";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";

/* Illustrative visuals for the four steps. Every figure here is a labelled example. */

function Frame({ children, tone, label }: { children: React.ReactNode; tone: "ember" | "horizon"; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-line bg-[linear-gradient(180deg,#0f0f11,#08080a)] p-6 md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-[340px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            tone === "ember"
              ? "radial-gradient(circle, rgb(255 138 61 / 0.35), rgb(226 69 43 / 0.15) 45%, transparent 70%)"
              : "radial-gradient(circle, rgb(45 91 255 / 0.4), rgb(127 227 255 / 0.1) 50%, transparent 70%)",
        }}
      />
      <div className="relative mb-5 flex items-center justify-between text-[12.5px] text-ink-3">
        <span>{label}</span>
        <span>Example</span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

// deterministic "revenue" shape, never shown as numbers
const BARS = Array.from({ length: 45 }, (_, i) =>
  Math.round((0.35 + 0.45 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.37)) + (i % 7 === 5 ? 0.15 : 0)) * 1000) / 1000,
);

export function ProveVisual() {
  return (
    <Frame tone="ember" label="Revenue proof">
      <div className="flex h-36 items-end gap-[2px]" aria-hidden>
        {BARS.map((h, i) => (
          <span key={i} className="dither flex-1 rounded-t-[2px]" style={{ height: `${h * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] text-ink-3">
        <span>90 days ago</span>
        <span className="inline-flex items-center gap-1">
          <Lock className="size-3" /> daily figures stay with the business
        </span>
        <span>today</span>
      </div>
      <div className="mt-6 rounded-[18px] border border-line-strong bg-white/[0.03] p-4">
        <div className="text-[12.5px] text-ink-3">What the lender receives</div>
        <div className="mt-1.5 font-display text-[22px] font-extralight tracking-[-0.02em] text-ink md:text-[26px]">
          Revenue ≥ $240,000
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill tone="good">Proof verifies</StatusPill>
          <StatusPill tone="good">Notary signature valid</StatusPill>
        </div>
      </div>
    </Frame>
  );
}

export function ApplyVisual() {
  const reduce = useReducedMotion();
  const [approved, setApproved] = useState(Boolean(reduce));
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setApproved((a) => !a), 2600);
    return () => clearInterval(t);
  }, [reduce]);
  return (
    <Frame tone="horizon" label="Application">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] text-ink-3">Working capital pool</div>
          <div className="mt-0.5 text-[17px] text-ink">Request $60,000</div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={String(approved)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            {approved ? <StatusPill tone="good">Approved</StatusPill> : <StatusPill tone="pending">In review</StatusPill>}
          </motion.span>
        </AnimatePresence>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line">
        {[
          ["Proven revenue", "≥ $240,000"],
          ["Advance", "25% of proven"],
          ["Borrower APR", "16.0%"],
          ["Term", "12 weeks"],
        ].map(([k, v]) => (
          <div key={k} className="bg-[#0c0c0e] p-4">
            <dt className="text-[12px] text-ink-3">{k}</dt>
            <dd className="num mt-1 text-[15px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-center gap-3 rounded-[18px] border border-line bg-white/[0.02] p-4 text-[13.5px] text-ink-2">
        <FileCheck2 className="size-4 shrink-0 text-horizon-2" />
        The pool manager sees the proof and your company profile, never your books.
      </div>
    </Frame>
  );
}

const PAYMENTS = [2140, 860, 3300, 1720, 2480];

export function SweepVisual() {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? PAYMENTS.length : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setN((x) => (x >= PAYMENTS.length + 2 ? 0 : x + 1)), 900);
    return () => clearInterval(t);
  }, [reduce]);
  const due = 5400;
  const received = PAYMENTS.slice(0, Math.min(n, PAYMENTS.length)).reduce((a, b) => a + b, 0);
  const swept = Math.min(due, received);
  const released = Math.max(0, received - due);
  return (
    <Frame tone="ember" label="Lockbox, this week">
      <ul className="flex h-[44px] items-center gap-2 overflow-hidden" aria-label="Incoming customer payments">
        <AnimatePresence initial={false}>
          {PAYMENTS.slice(0, Math.min(n, PAYMENTS.length)).map((p, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass num inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink"
            >
              <ArrowDownToLine className="size-3.5 text-ember-1" />${p.toLocaleString("en-US")}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="mt-6">
        <div className="mb-2 flex justify-between text-[13px]">
          <span className="text-ink-2">Weekly installment</span>
          <span className="num text-ink">
            ${swept.toLocaleString("en-US")} / ${due.toLocaleString("en-US")}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,#ff8a3d,#e2452b)]" animate={{ width: `${(swept / due) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-[13px]">
          <span className="text-ink-2">Released to the business</span>
          <span className="num text-ink">${released.toLocaleString("en-US")}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="h-full rounded-full bg-junior" animate={{ width: `${Math.min(100, (released / 5100) * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
      </div>
      <p className={cn("mt-5 inline-flex items-center gap-2 text-[13px] transition-opacity", swept >= due ? "text-junior-text opacity-100" : "text-ink-3")}>
        <Check className="size-4" /> {swept >= due ? "Installment covered. Everything else goes to the business." : "Payments fill the installment first."}
      </p>
    </Frame>
  );
}

export function WaterfallVisual() {
  return (
    <Frame tone="horizon" label="Weekly settlement">
      <Cascade
        total={100000}
        steps={[
          { label: "Interest collected", value: 100000, cls: "bg-ink-2" },
          { label: "Protocol fee", value: 5000, cls: "bg-ink-3" },
          { label: "Senior coupon", value: 61000, cls: "bg-senior" },
          { label: "Junior residual", value: 34000, cls: "bg-junior" },
        ]}
      />
      <div className="my-6 h-px bg-line" />
      <Cascade
        total={300000}
        steps={[
          { label: "Default loss", value: 300000, cls: "loss-hatch" },
          { label: "Junior absorbs", value: 300000, cls: "bg-junior" },
          { label: "Senior absorbs", value: 0, cls: "bg-senior" },
        ]}
      />
      <p className="mt-5 text-[13px] leading-relaxed text-ink-3">
        Every line above is a ledger entry. Anyone can recompute it from the public book.
      </p>
    </Frame>
  );
}
