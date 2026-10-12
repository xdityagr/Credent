const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const int = new Intl.NumberFormat("en-US");

export const DASH = "—";

/** Format integer cents. Null/undefined renders as an em dash, never a fake zero. */
export function usd(cents: number | null | undefined, mode: "whole" | "exact" | "compact" = "whole"): string {
  if (cents == null || !Number.isFinite(cents)) return DASH;
  const dollars = cents / 100;
  if (mode === "exact") return usd2.format(dollars);
  if (mode === "compact") return compact.format(dollars);
  return usd0.format(dollars);
}

/** Split "$122.10" into ["$", "122", ".10"] for wallet-style big numbers. */
export function usdParts(cents: number): { sign: string; whole: string; frac: string } {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  return {
    sign: neg ? "-$" : "$",
    whole: int.format(Math.floor(abs / 100)),
    frac: `.${String(abs % 100).padStart(2, "0")}`,
  };
}

export function count(n: number | null | undefined): string {
  if (n == null) return DASH;
  return int.format(n);
}

export function pct(bps: number | null | undefined, digits = 1): string {
  if (bps == null) return DASH;
  return `${(bps / 100).toFixed(digits)}%`;
}

export function price(e6: number): string {
  return (e6 / 1_000_000).toFixed(4);
}

export function short(hash: string | null | undefined, head = 4, tail = 4): string {
  if (!hash) return "";
  const h = hash.startsWith("0x") ? hash.slice(2) : hash;
  const prefix = hash.startsWith("0x") ? "0x" : "";
  if (h.length <= head + tail + 1) return hash;
  return `${prefix}${h.slice(0, head)}…${tail > 0 ? h.slice(-tail) : ""}`;
}

export function weeks(epochs: number): string {
  return `${epochs} week${epochs === 1 ? "" : "s"}`;
}

export function toCents(dollars: string): number | null {
  const n = Number(dollars.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function date(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? DASH : dateFmt.format(d);
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? DASH : dateTimeFmt.format(d);
}

export function relative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return DASH;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return DASH;
  const s = Math.round((now - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return date(iso);
}

export const explorerTx = (sig: string, cluster = "devnet") =>
  `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`;
export const explorerAddress = (addr: string, cluster = "devnet") =>
  `https://explorer.solana.com/address/${addr}?cluster=${cluster}`;
