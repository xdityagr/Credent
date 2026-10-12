"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";

type Tone = "ember" | "horizon";

const SURFACE: Record<Tone, string> = {
  ember: [
    // the curved streak (Lume card)
    "radial-gradient(130% 95% at 112% 118%, transparent 50%, rgb(255 170 110 / 0.9) 53.5%, #ff8a3d 55%, #e2452b 58.5%, rgb(58 15 10 / 0.9) 64%, transparent 71%)",
    "radial-gradient(90% 70% at 100% 100%, rgb(226 69 43 / 0.35), transparent 70%)",
    // teal undertone
    "radial-gradient(80% 90% at -10% -10%, rgb(15 59 58 / 0.95), transparent 60%)",
    "linear-gradient(160deg, #101413 0%, #0a0909 55%, #140806 100%)",
  ].join(","),
  horizon: [
    "radial-gradient(130% 95% at -12% 118%, transparent 50%, rgb(200 220 255 / 0.85) 53.5%, #8fb4ff 55%, #2d5bff 59%, rgb(10 20 70 / 0.9) 65%, transparent 72%)",
    "radial-gradient(90% 70% at 0% 100%, rgb(45 91 255 / 0.35), transparent 70%)",
    "radial-gradient(80% 90% at 110% -10%, rgb(127 227 255 / 0.25), transparent 60%)",
    "linear-gradient(200deg, #0b0f1a 0%, #07080c 60%, #050814 100%)",
  ].join(","),
};

/**
 * CreditNote3D: the iridescent "credit note" (our product is credit). Floats,
 * tilts toward the cursor and a light sheen follows it. Static under reduced motion.
 */
export function CreditNote3D({
  tone = "ember",
  rotate = 0,
  className,
  float = true,
  children,
}: {
  tone?: Tone;
  rotate?: number;
  className?: string;
  float?: boolean;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 110, damping: 16, mass: 0.6 });
  const ry = useSpring(0, { stiffness: 110, damping: 16, mass: 0.6 });
  const mx = useMotionValue(30);
  const my = useMotionValue(20);
  const sheen = useMotionTemplate`radial-gradient(circle at ${mx}% ${my}%, rgb(255 255 255 / 0.32), rgb(255 255 255 / 0.06) 28%, transparent 55%)`;
  const irid = useMotionTemplate`linear-gradient(${mx}deg, rgb(255 120 80 / 0.0), rgb(120 255 220 / 0.12) 30%, rgb(140 160 255 / 0.14) 50%, rgb(255 180 120 / 0.1) 70%, rgb(255 255 255 / 0))`;

  useEffect(() => {
    if (reduce) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2)));
      ry.set(dx * 16);
      rx.set(-dy * 12);
      mx.set(50 + dx * 45);
      my.set(50 + dy * 45);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, rx, ry, mx, my]);

  return (
    <div className={cn("[perspective:1200px]", className)}>
      <div className={cn(float && !reduce && "animate-float")}>
        <motion.div
          ref={ref}
          style={{ rotateX: rx, rotateY: ry, rotateZ: rotate, transformStyle: "preserve-3d" }}
          className="relative aspect-[1.586] w-full overflow-hidden rounded-[22px] shadow-[0_40px_120px_-30px_rgb(0_0_0/0.9),0_0_0_1px_rgb(255_255_255/0.08)]"
        >
          <div className="absolute inset-0" style={{ background: SURFACE[tone] }} />
          {/* fine grain */}
          <div
            className="absolute inset-0 opacity-[0.22] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
          />
          <motion.div className="absolute inset-0 mix-blend-screen" style={{ background: irid }} />
          <motion.div className="absolute inset-0 mix-blend-overlay" style={{ background: sheen }} />
          <div className="edge absolute inset-0 rounded-[22px]" />
          <div className="relative flex h-full flex-col justify-between p-[7%] text-white">{children ?? <NoteFace tone={tone} />}</div>
        </motion.div>
      </div>
    </div>
  );
}

function Chip() {
  return (
    <div className="relative aspect-[1.3] w-[13%] min-w-7 overflow-hidden rounded-[6px] bg-[linear-gradient(135deg,#d9d9d9,#7d7d7d_45%,#cfcfcf_60%,#8a8a8a)] opacity-85 shadow-inner">
      <div className="absolute inset-x-0 top-1/3 h-px bg-black/30" />
      <div className="absolute inset-x-0 top-2/3 h-px bg-black/30" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-black/30" />
    </div>
  );
}

function NoteFace({ tone }: { tone: Tone }) {
  if (tone === "horizon") {
    return (
      <>
        <div className="flex items-start justify-between">
          <span className="font-serif text-[clamp(14px,1.5vw,20px)] italic text-white/80">Senior tranche</span>
          <Logo className="h-4 w-auto text-white/80" />
        </div>
        <div>
          <div className="text-[clamp(9px,0.8vw,11px)] text-white/55">Fixed coupon, paid first</div>
          <div className="font-display text-[clamp(22px,2.6vw,36px)] font-extralight tracking-tight">
            9.5<span className="text-white/50">%</span>
          </div>
        </div>
        <div className="flex items-end justify-between text-[clamp(9px,0.8vw,11px)] text-white/60">
          <span>Public book, anchored to Solana</span>
          <span className="font-mono">LND-2C41</span>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="flex items-start justify-between">
        <Chip />
        <div className="flex items-center gap-2 text-white/85">
          <Logo className="h-4 w-auto" />
          <span className="text-[clamp(10px,0.9vw,12px)] font-medium tracking-wide">Credent note</span>
        </div>
      </div>
      <div>
        <div className="text-[clamp(9px,0.8vw,11px)] text-white/55">Proven 90-day revenue</div>
        <div className="font-display text-[clamp(22px,2.6vw,36px)] font-extralight tracking-tight">
          <span className="text-white/55">≥ $</span>240,000
        </div>
        <div className="dither mt-2 h-[9px] w-[58%] rounded-full opacity-90" title="Daily figures stay private" />
      </div>
      <div className="flex items-end justify-between text-[clamp(9px,0.8vw,11px)] text-white/65">
        <div>
          <div className="font-mono text-white/85">BRW-7F3A</div>
          <div>12 weekly installments</div>
        </div>
        <span className="font-serif text-[clamp(13px,1.3vw,17px)] italic text-white/70">specimen</span>
      </div>
    </>
  );
}
