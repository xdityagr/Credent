import { cn } from "@/lib/cn";

type Tone = "ember" | "horizon";

/** A soft radial glow sitting behind one word of a headline (Lume). */
export function GlowText({
  children,
  tone = "ember",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const glow =
    tone === "ember"
      ? "radial-gradient(closest-side, rgb(255 120 50 / 0.55), rgb(226 69 43 / 0.28) 45%, rgb(15 59 58 / 0.18) 70%, transparent)"
      : "radial-gradient(closest-side, rgb(80 120 255 / 0.55), rgb(45 91 255 / 0.25) 50%, rgb(127 227 255 / 0.1) 75%, transparent)";
  return (
    <span className={cn("relative inline-block", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-[30%] -inset-y-[45%] -z-10 blur-2xl"
        style={{ background: glow }}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

/** Blurred gradient blob (wallet references). Purely decorative. */
export function Blob({
  tone = "ember",
  className,
  style,
}: {
  tone?: Tone | "teal";
  className?: string;
  style?: React.CSSProperties;
}) {
  const bg =
    tone === "ember"
      ? "radial-gradient(circle at 40% 40%, #ff8a3d, #e2452b 40%, rgb(58 15 10 / 0.6) 65%, transparent 72%)"
      : tone === "teal"
        ? "radial-gradient(circle, #0f3b3a, rgb(15 59 58 / 0.4) 50%, transparent 70%)"
        : "radial-gradient(circle at 50% 40%, #8fb4ff, #2d5bff 40%, rgb(45 91 255 / 0.3) 60%, transparent 72%)";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute rounded-full blur-3xl", className)} style={{ background: bg, ...style }} />
  );
}

/** A glowing planet-edge arc (Neonverse / Aircash). Place at the bottom of a section. */
export function HorizonArc({
  tone = "horizon",
  className,
  intensity = 1,
}: {
  tone?: Tone;
  className?: string;
  intensity?: number;
}) {
  const rim = tone === "horizon" ? "#cfe0ff" : "#ffd1b0";
  const c1 = tone === "horizon" ? "45 91 255" : "226 69 43";
  const c2 = tone === "horizon" ? "127 227 255" : "255 138 61";
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none relative h-[360px] w-full overflow-hidden [mask-image:linear-gradient(180deg,transparent,#000_30%)]", className)}
    >
      {/* atmosphere */}
      <div
        className="absolute left-1/2 top-[60px] h-[900px] w-[180%] -translate-x-1/2 rounded-[50%] blur-[60px]"
        style={{
          opacity: intensity,
          background: `radial-gradient(50% 18% at 50% 0%, rgb(${c2} / 0.55), rgb(${c1} / 0.35) 45%, transparent 100%)`,
        }}
      />
      {/* planet body + rim light */}
      <div
        className="absolute left-1/2 top-[120px] h-[1400px] w-[200%] -translate-x-1/2 rounded-[50%] bg-black"
        style={{
          boxShadow: `0 -2px 0 0 ${rim}, 0 -10px 30px 0 rgb(${c2} / ${0.7 * intensity}), 0 -40px 120px 10px rgb(${c1} / ${0.55 * intensity}), inset 0 30px 80px -20px rgb(${c1} / 0.45)`,
        }}
      />
      {/* fade the rim out at the sides */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,transparent_22%,transparent_78%,#000_100%)]" />
    </div>
  );
}

/** Lume-style hairline vertical column lines behind a section. */
export function ColumnLines({ cols = 4, className }: { cols?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("column-lines", className)} style={{ "--cols": cols } as React.CSSProperties}>
      {Array.from({ length: cols }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}
