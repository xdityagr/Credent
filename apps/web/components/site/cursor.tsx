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

    // Magnetic pull, eased in a rAF loop. Each element's resting rect is its
    // measured rect minus the offset we applied, so the pull never feeds back on
    // itself; a release margin keeps the edge from flickering grab/release.
    const STRENGTH_X = 0.2;
    const STRENGTH_Y = 0.28;
    const MARGIN = 18;
    const EASE = 0.16;
    const offsets = new Map<HTMLElement, { x: number; y: number }>();
    let magnet: HTMLElement | null = null;
    let px = -1e4;
    let py = -1e4;
    let frame = 0;

    const home = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const o = offsets.get(el) ?? { x: 0, y: 0 };
      return { left: r.left - o.x, top: r.top - o.y, width: r.width, height: r.height };
    };
    const inside = (el: HTMLElement, margin: number) => {
      const h = home(el);
      return px >= h.left - margin && px <= h.left + h.width + margin && py >= h.top - margin && py <= h.top + h.height + margin;
    };
    const tick = () => {
      frame = 0;
      if (magnet && !magnet.isConnected) magnet = null;
      if (magnet && !inside(magnet, MARGIN)) magnet = null;
      let moving = false;
      if (magnet && !offsets.has(magnet)) offsets.set(magnet, { x: 0, y: 0 });
      for (const [el, o] of offsets) {
        let tx = 0;
        let ty = 0;
        if (el === magnet) {
          const h = home(el);
          tx = (px - (h.left + h.width / 2)) * STRENGTH_X;
          ty = (py - (h.top + h.height / 2)) * STRENGTH_Y;
        }
        o.x += (tx - o.x) * EASE;
        o.y += (ty - o.y) * EASE;
        if (el !== magnet && Math.abs(o.x) < 0.05 && Math.abs(o.y) < 0.05) {
          el.style.translate = "";
          offsets.delete(el);
          continue;
        }
        el.style.translate = `${o.x.toFixed(2)}px ${o.y.toFixed(2)}px`;
        moving = true;
      }
      if (moving) frame = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    let lastLabel: string | null = null;
    let lastHot = false;
    let shown = false;
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      px = e.clientX;
      py = e.clientY;
      if (!shown) {
        shown = true;
        setVisible(true);
      }
      const t = e.target as Element | null;
      const nextLabel = t?.closest<HTMLElement>("[data-cursor]")?.dataset.cursor || null;
      if (nextLabel !== lastLabel) setLabel((lastLabel = nextLabel));
      const m = t?.closest<HTMLElement>("[data-magnetic]") ?? null;
      const interactive = Boolean(m || t?.closest("a,button,[role=button],input,select,textarea,label,summary"));
      if (interactive !== lastHot) setHot((lastHot = interactive));
      if (m && m !== magnet) magnet = m;
      kick();
    };
    const onLeave = () => {
      shown = false;
      setVisible(false);
      magnet = null;
      kick();
    };
    const release = () => {
      if (frame) cancelAnimationFrame(frame);
      for (const el of offsets.keys()) el.style.translate = "";
      offsets.clear();
    };
    const onDown = () => setDown(true);
    const onUp = () => setDown(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("scroll", kick, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("has-cursor");
      release();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", kick);
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
