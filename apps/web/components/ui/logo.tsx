import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Credent mark: two offset arcs, a private half (ember) and a public half
 * (horizon), meeting at one point. Monochrome by default; `colour` for the app.
 */
export function Logo({ className, colour = false }: { className?: string; colour?: boolean }) {
  // unique ids: a gradient defined inside a display:none copy (e.g. the hidden sidebar) would blank every other copy
  const uid = useId().replace(/:/g, "");
  const e = `lg-e-${uid}`;
  const h = `lg-h-${uid}`;
  return (
    <svg viewBox="0 0 28 28" fill="none" className={cn("h-6 w-6", className)} aria-hidden>
      <defs>
        <linearGradient id={e} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#e2452b" />
        </linearGradient>
        <linearGradient id={h} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2d5bff" />
          <stop offset="1" stopColor="#8fb4ff" />
        </linearGradient>
      </defs>
      <path d="M22 7.2A10 10 0 1 0 22 20.8" stroke={colour ? `url(#${e})` : "currentColor"} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M17.5 9.6a5.6 5.6 0 1 0 0 8.8" stroke={colour ? `url(#${h})` : "currentColor"} strokeWidth="2.4" strokeLinecap="round" opacity={colour ? 1 : 0.6} />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <Logo colour className="h-6 w-6" />
      <span className="text-[17px] font-medium tracking-[-0.02em]">Credent</span>
    </span>
  );
}
