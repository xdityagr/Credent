"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SETTINGS_NAV } from "@/lib/nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Your profile, your organization, linked wallets and sign-in security." />
      <nav aria-label="Settings" className="inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-white/[0.03] p-1">
        {SETTINGS_NAV.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn("relative inline-flex h-8 items-center rounded-full px-4 text-[13px] transition-colors", active ? "text-black" : "text-ink-2 hover:text-ink")}
            >
              {active && <motion.span layoutId="settings-tab" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{t.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="max-w-[760px]">{children}</div>
    </div>
  );
}
