"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { explorerAddress, explorerTx, short } from "@/lib/format";

function useCopy() {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      } catch {
        /* clipboard blocked */
      }
    },
  };
}

/** Monospace hash with copy. `full` wraps the whole value. */
export function Hash({
  value,
  head = 6,
  tail = 4,
  full = false,
  copy = true,
  className,
}: {
  value: string | null | undefined;
  head?: number;
  tail?: number;
  full?: boolean;
  copy?: boolean;
  className?: string;
}) {
  const { copied, copy: doCopy } = useCopy();
  if (!value) return <span className="text-ink-3">—</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 font-mono text-[12.5px] text-ink-2", className)}>
      <span className={cn(full ? "break-all" : "truncate")} title={value}>
        {full ? value : short(value, head, tail)}
      </span>
      {copy && (
        <button
          type="button"
          onClick={() => doCopy(value)}
          className="shrink-0 rounded p-0.5 text-ink-3 transition hover:text-ink"
          aria-label={copied ? "Copied" : "Copy to clipboard"}
        >
          {copied ? <Check className="size-3.5 text-junior-text" /> : <Copy className="size-3.5" />}
        </button>
      )}
    </span>
  );
}

/** A Solana address linking to Explorer (devnet). */
export function Address({
  value,
  cluster = "devnet",
  className,
  head = 4,
  tail = 4,
}: {
  value: string | null | undefined;
  cluster?: string;
  className?: string;
  head?: number;
  tail?: number;
}) {
  const { copied, copy } = useCopy();
  if (!value) return <span className="text-ink-3">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[12.5px] text-ink-2", className)}>
      <a
        href={explorerAddress(value, cluster)}
        target="_blank"
        rel="noreferrer"
        title={`${value} on Solana Explorer`}
        className="underline decoration-line-strong underline-offset-[3px] transition hover:text-ink hover:decoration-ink-2"
      >
        {short(value, head, tail)}
      </a>
      <button type="button" onClick={() => copy(value)} className="text-ink-3 transition hover:text-ink" aria-label={copied ? "Copied" : "Copy address"}>
        {copied ? <Check className="size-3.5 text-junior-text" /> : <Copy className="size-3.5" />}
      </button>
    </span>
  );
}

/** A transaction signature linking to Solana Explorer. */
export function TxLink({
  signature,
  href,
  cluster = "devnet",
  label,
  className,
}: {
  signature: string | null | undefined;
  href?: string | null;
  cluster?: string;
  label?: string;
  className?: string;
}) {
  if (!signature && !href) return <span className="text-ink-3">—</span>;
  const url = href ?? explorerTx(signature!, cluster);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[12.5px] text-horizon-2 transition hover:text-white",
        className,
      )}
      title="View on Solana Explorer"
    >
      {label ?? short(signature ?? "", 6, 6)}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}
