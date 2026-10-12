import { cn } from "@/lib/cn";

/**
 * The real stack, not press logos. Simple monochrome marks drawn inline so
 * nothing is borrowed artwork.
 */
const TECH = [
  {
    name: "Solana",
    role: "settlement & anchors",
    mark: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path d="M5 7h13l-2.5 2.5H2.5zM5 17.5h13L15.5 20H2.5zM2.5 12.25h13l2.5 2.5H5z" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Noir",
    role: "revenue circuit",
    mark: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Barretenberg",
    role: "UltraHonk prover",
    mark: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path d="M3 19 9 7l4 7 3-5 5 10z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Stripe",
    role: "revenue source",
    mark: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14.5 9.2c-.6-.4-1.5-.7-2.4-.7-1.2 0-1.9.5-1.9 1.2 0 1.9 4.6 1 4.6 4 0 1.4-1.2 2.3-3 2.3-1 0-2-.3-2.8-.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "zkTLS",
    role: "notarized sessions",
    mark: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <rect x="5" y="10" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
];

export function TechRow({ className }: { className?: string }) {
  return (
    <div className={cn("glass mx-auto max-w-[920px] rounded-[24px] px-6 py-5", className)}>
      <p className="text-left text-[12.5px] text-ink-3">Built with</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 md:grid-cols-5">
        {TECH.map((t) => (
          <li key={t.name} className="flex items-center gap-2.5 text-left text-ink-2">
            <span className="text-ink">{t.mark}</span>
            <span className="min-w-0">
              <span className="block text-[15px] font-medium tracking-[-0.01em] text-ink">{t.name}</span>
              <span className="block truncate text-[11.5px] text-ink-3">{t.role}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
