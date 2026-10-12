"use client";

import { Anchor, Binary, Link2 } from "lucide-react";
import { LedgerFeed, LedgerSkeleton } from "@/components/data/ledger-feed";
import { ButtonLink, IconChip } from "@/components/ui";
import { useLive } from "@/lib/live";
import { useLedger } from "@/lib/queries";

const CHECKS = [
  {
    icon: <Link2 />,
    title: "Recompute the hash chain",
    body: "Each ledger entry commits to the one before it. One button in the explorer re-hashes every entry and reports where the chain breaks, if it ever does.",
  },
  {
    icon: <Anchor />,
    title: "Find the anchor on Solana",
    body: "Entries are sealed into blocks whose Merkle roots are written to devnet as memos. Each block links to its transaction on Solana Explorer.",
  },
  {
    icon: <Binary />,
    title: "Re-run the proof",
    body: "Every revenue claim has a proof page. Verify it on our server, or download the proof and verification key and run Barretenberg yourself.",
  },
];

export function VerifySection() {
  const { data, isPending, error } = useLedger({ limit: 6 });
  const { connected } = useLive();
  return (
    <section className="relative overflow-hidden border-y border-line bg-[radial-gradient(60%_80%_at_80%_0%,rgb(45_91_255/0.08),transparent_70%)]">
      <div className="mx-auto grid max-w-[1280px] gap-14 px-5 py-20 md:px-8 md:py-28 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="max-w-[14ch] font-serif text-[clamp(40px,5.4vw,72px)] leading-[0.98] tracking-[-0.03em] text-[#f4f1ee]">
            Don&apos;t trust us. <span className="italic text-ink-2">Check.</span>
          </h2>
          <ul className="mt-10 space-y-7">
            {CHECKS.map((c) => (
              <li key={c.title} className="flex gap-4">
                <IconChip tone="horizon">{c.icon}</IconChip>
                <div>
                  <h3 className="text-[16px] font-medium text-ink">{c.title}</h3>
                  <p className="mt-1 max-w-[50ch] text-[14.5px] leading-relaxed text-ink-2">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/explorer" variant="horizon" magnetic>
              Open the explorer
            </ButtonLink>
            <ButtonLink href="/docs#privacy" variant="ghost">
              Read the privacy model
            </ButtonLink>
          </div>
        </div>

        <div className="glass edge self-start rounded-[28px] p-5 md:p-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <span className="text-[14px] text-ink">Latest ledger entries</span>
            <span className="inline-flex items-center gap-2 text-[12.5px] text-ink-3">
              <span className={connected ? "size-1.5 animate-pulse-dot rounded-full bg-junior-text" : "size-1.5 rounded-full bg-ink-3"} />
              {connected ? "Streaming" : "Not connected"}
            </span>
          </div>
          {isPending ? (
            <LedgerSkeleton rows={5} />
          ) : data && data.length > 0 ? (
            <LedgerFeed events={data} />
          ) : (
            <div className="py-10 text-center text-[14px] leading-relaxed text-ink-3">
              {error ? "The ledger feed appears here when the API is reachable." : "No ledger entries yet."}
              <br />
              <span className="font-mono text-[12px]">GET /api/public/ledger</span>
            </div>
          )}
          <div className="mt-2 rounded-[14px] border border-line bg-black/50 p-4 font-mono text-[12px] leading-relaxed text-ink-2">
            <span className="text-ink-3"># verify a revenue proof offline</span>
            <br />
            bb verify -p proof -i public_inputs -k vk
          </div>
        </div>
      </div>
    </section>
  );
}
