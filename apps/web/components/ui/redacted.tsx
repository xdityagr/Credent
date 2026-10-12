"use client";

import { Lock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const HOLD_MS = 450;

/**
 * Redacted: an ember dither mask over a private number. Its owner reveals it by
 * pressing and holding (pointer, Space or Enter); it re-seals on release. For
 * anyone else it is just the mask, which is all the public ever gets.
 */
export function Redacted({
  children,
  canReveal = false,
  label = "Private value",
  className,
  width,
}: {
  children: React.ReactNode;
  canReveal?: boolean;
  label?: string;
  className?: string;
  /** Mask width when the value is hidden, e.g. "7ch". */
  width?: string;
}) {
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const raf = useRef<number | null>(null);
  const start = useRef(0);

  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setProgress(0);
    setOpen(false);
  }, []);

  const begin = useCallback(() => {
    if (!canReveal || raf.current) return;
    start.current = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        setOpen(true);
        raf.current = null;
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [canReveal]);

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  if (!canReveal) {
    return (
      <span
        className={cn("dither inline-block h-[0.95em] translate-y-[0.12em] rounded-[4px] align-baseline", className)}
        style={{ width: width ?? "6ch" }}
        role="img"
        aria-label={`${label}: hidden. Only the business can see this.`}
        title="Private. Only the business can see this."
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "group relative inline-flex select-none items-center rounded-[6px] align-baseline outline-offset-2",
        className,
      )}
      aria-label={open ? `${label} (revealed)` : `${label}: press and hold to reveal`}
      aria-pressed={open}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        begin();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") stop();
      }}
      onBlur={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className={cn("transition-[filter,opacity] duration-200", open ? "opacity-100 blur-0" : "opacity-0 blur-sm")}>
        {children}
      </span>
      <span
        aria-hidden
        className={cn(
          "dither absolute inset-0 overflow-hidden rounded-[6px] transition-opacity duration-200",
          open ? "opacity-0" : "opacity-100",
        )}
      >
        <span
          className="absolute inset-y-0 left-0 bg-white/25"
          style={{ width: `${progress * 100}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center gap-1 text-[11px] font-medium text-white/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Lock className="size-3" /> Hold
        </span>
      </span>
    </button>
  );
}
