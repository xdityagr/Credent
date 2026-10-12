"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { usdParts } from "@/lib/format";

/**
 * Ticker: rolls a number from its previous value to the new one. The DOM text
 * is written directly so a roll never re-renders React. Starts when visible.
 */
export function Ticker({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  className,
  duration = 1.1,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const fmt = useRef(format);

  useEffect(() => {
    fmt.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !inView) {
      el.textContent = fmt.current(reduce ? value : prev.current);
      if (reduce) prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = fmt.current(v);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, inView, reduce, duration]);

  return (
    <span ref={ref} className={cn("num", className)} aria-label={format(value)}>
      {format(0)}
    </span>
  );
}

/**
 * Wallet-style amount: "$122.10" in the wide display face with a smaller,
 * dimmer currency sign and cents (refs 2–5).
 */
export function BigAmount({
  cents,
  className,
  size = "lg",
}: {
  cents: number | null | undefined;
  className?: string;
  size?: "md" | "lg" | "xl";
}) {
  const sz = size === "xl" ? "text-[clamp(44px,6vw,76px)]" : size === "lg" ? "text-[clamp(34px,4vw,52px)]" : "text-[28px]";
  if (cents == null) {
    return (
      <span className={cn("font-display font-extralight leading-none tracking-[-0.02em] text-ink-3", sz, className)}>
        —
      </span>
    );
  }
  const p = usdParts(cents);
  return (
    <span className={cn("num inline-flex items-baseline font-display font-extralight leading-none tracking-[-0.02em]", sz, className)}>
      <span className="mr-[0.08em] text-[0.55em] text-ink-2">{p.sign}</span>
      {p.whole}
      <span className="text-[0.5em] text-ink-2">{p.frac}</span>
    </span>
  );
}
