import Link from "next/link";
import { Wordmark } from "@/components/ui";

const COLS = [
  {
    title: "Product",
    links: [
      { href: "/pools", label: "Pools" },
      { href: "/explorer", label: "Public ledger" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/signup", label: "Create an account" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/docs#privacy", label: "Privacy model" },
      { href: "/docs#glossary", label: "Glossary" },
      { href: "/docs#wallets", label: "Devnet wallet setup" },
      { href: "/docs#faq", label: "FAQ" },
    ],
  },
  {
    title: "Verify",
    links: [
      { href: "/explorer", label: "Recompute the hash chain" },
      { href: "https://explorer.solana.com/?cluster=devnet", label: "Solana Explorer (devnet)" },
      { href: "https://noir-lang.org", label: "Noir" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-line">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div className="max-w-[34ch]">
          <Wordmark />
          <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
            Private credit, public book. Businesses prove revenue without revealing it; every loan, tranche and loss is on a
            ledger anyone can check.
          </p>
          <p className="mt-6 text-[12.5px] leading-relaxed text-ink-3">
            Runs on Solana devnet with test cUSD. Not an offer of securities or credit.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h3 className="text-[13px] text-ink-3">{c.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href + l.label}>
                  {l.href.startsWith("http") ? (
                    <a href={l.href} target="_blank" rel="noreferrer" className="text-[14px] text-ink-2 transition hover:text-white">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-[14px] text-ink-2 transition hover:text-white">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="overflow-hidden">
        <div
          aria-hidden
          className="mx-auto -mb-[0.22em] max-w-[1280px] select-none px-5 text-center font-serif text-[clamp(80px,19vw,280px)] leading-none tracking-[-0.04em] text-transparent md:px-8"
          style={{ backgroundImage: "linear-gradient(180deg, rgb(255 255 255 / 0.13), rgb(255 255 255 / 0))", WebkitBackgroundClip: "text", backgroundClip: "text" }}
        >
          Credent
        </div>
      </div>
    </footer>
  );
}
