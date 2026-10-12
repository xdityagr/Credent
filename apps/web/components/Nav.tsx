"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import { useLive } from "@/lib/live";
import { short } from "@/lib/format";

const LINKS = [
  { href: "/borrow", label: "Borrow" },
  { href: "/lend", label: "Lend" },
  { href: "/explorer", label: "Explorer" },
];

export function Nav() {
  const path = usePathname();
  const { session, signOut } = useSession();
  const { connected } = useLive();

  return (
    <header className="border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-8 px-5 md:px-8">
        <Link href="/" className="flex items-baseline gap-1 text-[22px] font-extrabold tracking-[-0.03em] text-ink">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-[4px] px-3 py-1.5 text-[15px] font-semibold transition-colors ${
                  active ? "bg-ink text-sheet" : "text-ink-soft hover:bg-paper-deep hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-[14px]">
          <span className="hidden items-center gap-1.5 text-ink-faint sm:flex" title="Live connection to the public ledger">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-junior" : "bg-rule-strong"}`} />
            {connected ? "Live" : "Offline"}
          </span>
          {session && (
            <span className="flex items-center gap-2">
              <span className="font-mono text-[13px] text-ink-soft">{short(session.wallet, 4, 4)}</span>
              {session.demo && <span className="text-ink-faint">demo</span>}
              <button onClick={signOut} className="font-semibold text-ink-soft hover:text-ink">
                Sign out
              </button>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

/** Wordmark with a ledger-green tick mark. */
function Wordmark() {
  return (
    <span className="relative">
      credent
      <span className="absolute -right-2 top-1 h-2 w-2 rounded-[1px] bg-junior" aria-hidden />
    </span>
  );
}
