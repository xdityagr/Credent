"use client";

import { ReactLenis } from "lenis/react";
import { useReducedMotion } from "motion/react";

/** Lenis smooth scrolling. Marketing pages only; off under reduced motion. */
export function SmoothScroll() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return <ReactLenis root options={{ lerp: 0.12, wheelMultiplier: 1, smoothWheel: true }} />;
}
