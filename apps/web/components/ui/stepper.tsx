import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** Horizontal stepper for wizards. `current` is zero-based. */
export function Stepper({
  steps,
  current,
  className,
  tone = "horizon",
}: {
  steps: string[];
  current: number;
  className?: string;
  tone?: "ember" | "horizon";
}) {
  return (
    <ol className={cn("flex items-center gap-2", className)} aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium transition-colors",
                done && (tone === "ember" ? "border-ember-1/50 bg-ember-1/15 text-ember-1" : "border-horizon-2/50 bg-horizon-1/20 text-horizon-2"),
                active && "border-white/60 bg-white text-black",
                !done && !active && "border-line-strong text-ink-3",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden truncate text-[12.5px] md:block", active ? "text-ink" : "text-ink-3")}>{s}</span>
            {i < steps.length - 1 && (
              <span className={cn("h-px min-w-3 flex-1", done ? "bg-line-bright" : "bg-line")} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
