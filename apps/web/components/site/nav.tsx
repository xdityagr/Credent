"use client";

import { Menu as MenuIcon } from "lucide-react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ButtonLink, IconButton, Sheet, SheetContent, SheetTrigger, Wordmark } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useMe } from "@/lib/queries";

export const SITE_LINKS = [
  { href: "/pools", label: "Pools" },
  { href: "/explorer", label: "Explorer" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/docs", label: "Docs" },
];

/** GlassPillNav: wordmark, a glass pill of links, and the account actions. */
export function SiteNav() {
  const pathname = usePathname();
  const { data: me } = useMe();
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  const authed = Boolean(me);
  const appHref = me?.onboarding.step && me.onboarding.step !== "done" ? "/onboarding" : "/app";

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 h-24 bg-gradient-to-b from-black via-black/70 to-transparent transition-opacity duration-500",
          scrolled ? "opacity-100" : "opacity-0",
        )}
      />
      <nav className="relative mx-auto flex h-[76px] max-w-[1280px] items-center justify-between gap-4 px-5 md:px-8" aria-label="Main">
        <Link href="/" className="rounded-lg" aria-label="Credent home">
          <Wordmark />
        </Link>

        <motion.ul
          initial={false}
          className="glass absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-full p-1 md:flex"
        >
          {SITE_LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-9 items-center rounded-full px-4 text-[14px] transition-colors",
                    active ? "text-white" : "text-ink-2 hover:text-white",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="site-nav-pill"
                      className="absolute inset-0 rounded-full bg-white/[0.09] shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative">{l.label}</span>
                </Link>
              </li>
            );
          })}
        </motion.ul>

        <div className="flex items-center gap-2">
          {authed ? (
            <ButtonLink href={appHref} variant="white" size="sm" magnetic>
              Open app
            </ButtonLink>
          ) : (
            <>
              <Link href="/login" className="hidden h-9 items-center rounded-full px-3 text-[14px] text-ink-2 transition hover:text-white sm:inline-flex">
                Log in
              </Link>
              <ButtonLink href="/signup" variant="white" size="sm" magnetic>
                Get started
              </ButtonLink>
            </>
          )}
          <MobileMenu pathname={pathname} authed={authed} />
        </div>
      </nav>
    </header>
  );
}

function MobileMenu({ pathname, authed }: { pathname: string; authed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton label="Open menu" className="md:hidden">
          <MenuIcon className="size-4" />
        </IconButton>
      </SheetTrigger>
      <SheetContent title="Menu">
        <ul className="flex flex-col p-3">
          {[{ href: "/", label: "Home" }, ...SITE_LINKS].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === l.href ? "page" : undefined}
                className="flex h-14 items-center rounded-2xl px-4 font-serif text-[28px] text-ink-2 transition hover:bg-white/5 hover:text-white aria-[current=page]:text-white"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        {!authed && (
          <div className="flex gap-2 border-t border-line p-5">
            <ButtonLink href="/login" className="flex-1">
              Log in
            </ButtonLink>
            <ButtonLink href="/signup" variant="white" className="flex-1">
              Get started
            </ButtonLink>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
