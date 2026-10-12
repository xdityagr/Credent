"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Bento card with a cursor-following spotlight on its border and surface.
 * `cursorLabel` sets the custom cursor's label (e.g. "View") on the site.
 */
export function SpotlightCard({
  children,
  className,
  tone = "neutral",
  cursorLabel,
  as: Tag = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "ember" | "horizon";
  cursorLabel?: string;
  as?: "div" | "article" | "li" | "section";
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const Comp = Tag as "div";
  const colour =
    tone === "ember" ? "255 138 61" : tone === "horizon" ? "127 160 255" : "255 255 255";

  return (
    <Comp
      ref={ref}
      data-cursor={cursorLabel}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--sx", `${e.clientX - r.left}px`);
        el.style.setProperty("--sy", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "group/spot relative isolate overflow-hidden rounded-[24px] border border-line bg-[linear-gradient(180deg,#0e0e10,#09090a)]",
        className,
      )}
      style={{ "--spot": colour } as React.CSSProperties}
      {...rest}
    >
      {/* surface wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{
          background: "radial-gradient(420px circle at var(--sx, 50%) var(--sy, 0%), rgb(var(--spot) / 0.07), transparent 60%)",
        }}
      />
      {/* border light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{
          padding: 1,
          background: "radial-gradient(300px circle at var(--sx, 50%) var(--sy, 0%), rgb(var(--spot) / 0.55), transparent 60%)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      {children}
    </Comp>
  );
}

/** Glass icon chip used in bento headers (Neonverse). */
export function IconChip({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "ember" | "horizon"; className?: string }) {
  return (
    <span
      className={cn(
        "glass inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] text-ink [&_svg]:size-[18px]",
        tone === "ember" && "text-ember-1",
        tone === "horizon" && "text-horizon-2",
        className,
      )}
    >
      {children}
    </span>
  );
}
