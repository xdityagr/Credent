"use client";

import { motion } from "motion/react";
import { Accordion as A, Tabs as T } from "radix-ui";
import { Plus } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";

// ---------------- Tabs ----------------

export const Tabs = T.Root;
export const TabsContent = T.Content;

/** Glass segmented tab list with a sliding pill. Pass the current `value`. */
export function TabsList({
  items,
  value,
  className,
}: {
  items: { value: string; label: React.ReactNode; count?: number }[];
  value: string;
  className?: string;
}) {
  const id = useId();
  return (
    <T.List className={cn("inline-flex items-center gap-1 rounded-full border border-line bg-white/[0.03] p-1", className)}>
      {items.map((it) => (
        <T.Trigger
          key={it.value}
          value={it.value}
          className="relative inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] text-ink-2 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-rim data-[state=active]:text-black"
        >
          {value === it.value && (
            <motion.span
              layoutId={`tab-${id}`}
              className="absolute inset-0 rounded-full bg-white"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative">{it.label}</span>
          {it.count != null && <span className="relative num text-[11px] opacity-60">{it.count}</span>}
        </T.Trigger>
      ))}
    </T.List>
  );
}

/** Same look without Radix semantics: a filter chip row (aria-pressed buttons). */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  className,
  label,
}: {
  options: { value: V; label: React.ReactNode }[];
  value: V;
  onChange: (v: V) => void;
  className?: string;
  label: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-label={label} className={cn("inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-white/[0.03] p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative inline-flex h-8 items-center rounded-full px-3.5 text-[13px] transition-colors",
            value === o.value ? "text-black" : "text-ink-2 hover:text-ink",
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------- Accordion ----------------

export function Accordion({ items, className }: { items: { q: string; a: React.ReactNode }[]; className?: string }) {
  return (
    <A.Root type="single" collapsible className={cn("divide-y divide-line border-y border-line", className)}>
      {items.map((it, i) => (
        <A.Item key={i} value={`i${i}`} className="group">
          <A.Header>
            <A.Trigger className="flex w-full items-center justify-between gap-6 py-5 text-left text-[16px] text-ink outline-none transition-colors hover:text-white focus-visible:text-white md:text-[17px]">
              {it.q}
              <span className="glass inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-data-[state=open]:rotate-45">
                <Plus className="size-4" />
              </span>
            </A.Trigger>
          </A.Header>
          <A.Content className="overflow-hidden data-[state=closed]:animate-[accordion-up_220ms_ease] data-[state=open]:animate-[accordion-down_260ms_var(--ease-out-expo)]">
            <div className="max-w-[68ch] pb-6 text-[15px] leading-relaxed text-ink-2">{it.a}</div>
          </A.Content>
        </A.Item>
      ))}
    </A.Root>
  );
}
