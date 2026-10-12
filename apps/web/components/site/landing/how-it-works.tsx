"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ApplyVisual, ProveVisual, SweepVisual, WaterfallVisual } from "../step-visuals";

export const STEPS = [
  {
    title: "Prove",
    lead: "Show revenue without showing your books.",
    body: "Connect Stripe through a zkTLS notary, upload signed payment receipts, or start with a demo business. A Noir circuit proves one statement: 90-day revenue is at least a threshold you choose. The daily figures never leave you.",
    Visual: ProveVisual,
  },
  {
    title: "Apply",
    lead: "Pick a pool whose terms fit.",
    body: "Lender companies run their own pools with published terms: APR, advance rate, term, minimum proven revenue. You apply with your proof; the pool manager approves or declines. Accept the terms with a wallet signature and the cUSD lands in your wallet.",
    Visual: ApplyVisual,
  },
  {
    title: "Sweep",
    lead: "Repay from revenue, automatically.",
    body: "Customer payments flow through a lockbox. Each week's installment is paid first; everything above it is released to you. No invoices to chase and no missed-payment surprises.",
    Visual: SweepVisual,
  },
  {
    title: "Waterfall",
    lead: "Lenders are paid in a published order.",
    body: "Interest pays the protocol fee, then the senior tranche's fixed coupon, then junior. If a loan defaults, junior absorbs the loss first. Every step is a public ledger entry anchored to Solana.",
    Visual: WaterfallVisual,
  },
];

function StepText({ i, onActive, active }: { i: number; onActive: (i: number) => void; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive(i);
  }, [inView, i, onActive]);
  const s = STEPS[i];
  const V = s.Visual;
  return (
    <div ref={ref} className="flex min-h-0 flex-col justify-center py-10 lg:min-h-[78vh] lg:py-0">
      <div className={cn("transition-opacity duration-500 lg:opacity-30", active && "lg:opacity-100")}>
        <div className="flex items-center gap-3 text-[13px] text-ink-3">
          <span className="num inline-flex size-7 items-center justify-center rounded-full border border-line-strong text-ink">{i + 1}</span>
          {s.title}
        </div>
        <h3 className="mt-5 max-w-[18ch] font-serif text-[clamp(32px,3.6vw,48px)] leading-[1.02] tracking-[-0.02em] text-[#f4f1ee]">{s.lead}</h3>
        <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-ink-2">{s.body}</p>
      </div>
      <div className="mt-8 lg:hidden">
        <V />
      </div>
    </div>
  );
}

/** Scrollytelling: step copy scrolls on the left, a sticky visual swaps on the right. */
export function HowItWorks({ heading = true }: { heading?: boolean }) {
  const [active, setActive] = useState(0);
  const V = STEPS[active].Visual;
  return (
    <section id="how" className="relative mx-auto max-w-[1280px] px-5 py-20 md:px-8 md:py-28">
      {heading && (
        <div className="max-w-[640px]">
          <h2 className="font-serif text-[clamp(40px,5.4vw,72px)] leading-[0.98] tracking-[-0.03em] text-[#f4f1ee]">
            From revenue to repaid, <span className="italic text-ink-2">in four steps</span>
          </h2>
        </div>
      )}
      <div className="mt-8 grid gap-x-16 lg:mt-0 lg:grid-cols-[1fr_1.05fr]">
        <div>
          {STEPS.map((_, i) => (
            <StepText key={i} i={i} onActive={setActive} active={active === i} />
          ))}
        </div>
        <div className="hidden lg:block">
          <div className="sticky top-[14vh] flex min-h-[72vh] items-center">
            <div className="w-full">
              <div className="mb-5 flex gap-1.5" aria-hidden>
                {STEPS.map((s, i) => (
                  <span key={s.title} className={cn("h-0.5 flex-1 rounded-full transition-colors duration-500", i <= active ? "bg-white/70" : "bg-white/10")} />
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <V />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
