"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Custom cursor for the marketing site: an exact dot plus a lagging ring, drawn
 * with mix-blend-difference. Grows with a label over [data-cursor] targets and
 * pulls [data-magnetic] buttons toward the pointer. Fine pointers only; never
 * under reduced motion.
 */
export function Cursor() {
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [hot, setHot] = useState(false);
  const [down, setDown] = useState(false);
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 380, damping: 32, mass: 0.5 });
  const ry = useSpring(y, { stiffness: 380, damping: 32, mass: 0.5 });

  useEffect(() => {
    if (reduce) return;
    const mq = window.matchMedia("(pointer: fine)");
    if (!mq.matches) return;
    const root = document.documentElement;
    root.classList.add("has-cursor");
    // enabling is a subscription to an external capability (pointer type)
    const raf = requestAnimationFrame(() => setEnabled(true));

    let magnet: HTMLElement | null = null;
    const release = () => {
      if (magnet) magnet.style.translate = "";
      magnet = null;
    };

    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
      const t = e.target as Element | null;
      const labelled = t?.closest<HTMLElement>("[data-cursor]");
      setLabel(labelled?.dataset.cursor || null);
      const m = t?.closest<HTMLElement>("[data-magnetic]");
      const interactive = t?.closest("a,button,[role=button],input,select,textarea,label,summary");
      setHot(Boolean(m || interactive));
      if (m !== magnet) release();
      if (m) {
        magnet = m;
        const r = m.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        m.style.translate = `${dx * 0.22}px ${dy * 0.3}px`;
      }
    };
    const onLeave = () => {
      setVisible(false);
      release();
    };
    const onDown = () => setDown(true);
    const onUp = () => setDown(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("has-cursor");
      release();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [reduce, x, y]);

  if (!enabled) return null;

  const ringSize = label ? 76 : hot ? 46 : 32;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] mix-blend-difference" style={{ opacity: visible ? 1 : 0 }}>
      <motion.div
        className="absolute left-0 top-0 rounded-full bg-white"
        style={{ x, y, width: 6, height: 6, translateX: "-50%", translateY: "-50%" }}
        animate={{ scale: hot || label ? 0 : down ? 0.6 : 1 }}
        transition={{ duration: 0.15 }}
      />
      <motion.div
        className="absolute left-0 top-0 flex items-center justify-center rounded-full border border-white"
        style={{ x: rx, y: ry, translateX: "-50%", translateY: "-50%" }}
        animate={{ width: ringSize, height: ringSize, scale: down ? 0.88 : 1, backgroundColor: label ? "rgb(255 255 255 / 1)" : "rgb(255 255 255 / 0)" }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
      >
        <AnimatePresence>
          {label && (
            <motion.span
              key={label}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className="text-[12px] font-medium text-black"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
