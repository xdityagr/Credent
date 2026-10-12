const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

/** Format integer cents. */
export function usd(cents: number, mode: "whole" | "exact" | "compact" = "whole"): string {
  const dollars = cents / 100;
  if (mode === "exact") return usd2.format(dollars);
  if (mode === "compact") return compact.format(dollars);
  return usd0.format(dollars);
}

export function pct(bps: number, digits = 1): string {
  return `${(bps / 100).toFixed(digits)}%`;
}

export function price(e6: number): string {
  return (e6 / 1_000_000).toFixed(4);
}

export function short(hash: string | null | undefined, head = 6, tail = 4): string {
  if (!hash) return "";
  const h = hash.startsWith("0x") ? hash.slice(2) : hash;
  const prefix = hash.startsWith("0x") ? "0x" : "";
  if (h.length <= head + tail + 1) return hash;
  // slice(-0) would return the whole string, so tail=0 needs its own branch.
  return `${prefix}${h.slice(0, head)}…${tail > 0 ? h.slice(-tail) : ""}`;
}

/** Sim days are counted from the start of the 90-day revenue history window. */
export function dayLabel(day: number): string {
  return `Day ${day}`;
}

export function weekOf(day: number): number {
  return Math.floor(day / 7);
}

export function toCents(dollars: string): number | null {
  const n = Number(dollars.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
