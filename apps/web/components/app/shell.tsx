"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  CheckCheck,
  ExternalLink,
  Globe,
  LogOut,
  Menu as MenuIcon,
  Settings,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  EmptyState,
  ErrorState,
  IconButton,
  Logo,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  OrgAvatar,
  Sheet,
  SheetContent,
  SheetTrigger,
  Skeleton,
  Wordmark,
} from "@/components/ui";
import { WalletMenu } from "@/components/app/wallet-menu";
import { cn } from "@/lib/cn";
import { relative } from "@/lib/format";
import { SHARED_NAV, isActive, navFor, type NavItem } from "@/lib/nav";
import { useLogout, useMarkRead, useMe, useNotifications } from "@/lib/queries";
import { SessionProvider } from "@/lib/session";
import type { Me, Notification } from "@/lib/types";

/**
 * The /app shell. Gates on the session (client-side; proxy.ts only checks the
 * cookie exists), then renders the role-aware sidebar and topbar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const data = me.data;

  useEffect(() => {
    if (me.isPending || me.error) return;
    if (data === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (data && data.onboarding.step !== "done") router.replace("/onboarding");
  }, [me.isPending, me.error, data, router, pathname]);

  if (me.error) {
    return (
      <ShellFrame me={null}>
        <div className="mx-auto max-w-[640px] pt-24">
          <ErrorState error={me.error} onRetry={() => me.refetch()} />
        </div>
      </ShellFrame>
    );
  }
  if (!data || !data.org || data.onboarding.step !== "done") {
    return (
      <ShellFrame me={null}>
        <ContentSkeleton />
      </ShellFrame>
    );
  }
  return (
    <SessionProvider value={data}>
      <ShellFrame me={data}>{children}</ShellFrame>
    </SessionProvider>
  );
}

function ShellFrame({ me, children }: { me: Me | null; children: React.ReactNode }) {
  const tone = me?.org?.kind === "LENDER" ? "horizon" : "ember";
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-[#050505] lg:flex">
        <Sidebar me={me} />
      </aside>
      <div className="relative min-w-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
          style={{
            background:
              tone === "horizon"
                ? "radial-gradient(50% 80% at 70% 0%, rgb(45 91 255 / 0.12), transparent 70%)"
                : "radial-gradient(50% 80% at 70% 0%, rgb(226 69 43 / 0.09), rgb(15 59 58 / 0.06) 50%, transparent 75%)",
          }}
        />
        <Topbar me={me} />
        <main id="main" className="mx-auto w-full max-w-[1200px] px-5 pb-20 pt-8 md:px-8 md:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({ item, pathname, badge, onNavigate }: { item: NavItem; pathname: string; badge?: number; onNavigate?: () => void }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-[12px] px-3 text-[14px] transition-colors",
        active ? "text-white" : "text-ink-2 hover:bg-white/[0.04] hover:text-ink",
      )}
    >
      {active && (
        <motion.span
          layoutId="app-nav-active"
          className="absolute inset-0 rounded-[12px] border border-white/10 bg-white/[0.07] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        />
      )}
      <item.icon className="relative size-[17px] shrink-0" aria-hidden />
      <span className="relative">{item.label}</span>
      {badge ? (
        <span className="num relative ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-medium text-black">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

function Sidebar({ me, onNavigate }: { me: Me | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const notifications = useNotifications(Boolean(me));
  const unread = (notifications.data ?? []).filter((n) => !n.read_at).length;
  const org = me?.org;
  const items = navFor(org?.kind);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] items-center px-5">
        <Link href="/" aria-label="Credent home" onClick={onNavigate}>
          <Wordmark />
        </Link>
      </div>

      <div className="px-3">
        {org ? (
          <div className="flex items-center gap-3 rounded-[16px] border border-line bg-white/[0.02] p-3">
            <OrgAvatar name={org.name} src={org.logo_url} kind={org.kind} size={36} />
            <div className="min-w-0">
              <div className="truncate text-[14px] text-ink">{org.name}</div>
              <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <span className={cn("size-1.5 rounded-full", org.kind === "LENDER" ? "bg-horizon-2" : "bg-ember-1")} />
                {org.kind === "LENDER" ? "Lender" : "Borrower"}
                <span className="font-mono">{org.pseudonym}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3">
            <Skeleton className="size-9 rounded-[30%]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
        )}
      </div>

      <nav aria-label="App" className="mt-5 flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {me
            ? items.map((it) => (
                <li key={it.href}>
                  <NavLink item={it} pathname={pathname} onNavigate={onNavigate} />
                </li>
              ))
            : Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="px-3 py-2.5">
                  <Skeleton className="h-3.5 w-28" />
                </li>
              ))}
        </ul>
      </nav>

      <div className="space-y-0.5 border-t border-line px-3 py-3">
        {SHARED_NAV.map((it) => (
          <NavLink key={it.href} item={it} pathname={pathname} badge={it.href === "/app/notifications" ? unread : undefined} onNavigate={onNavigate} />
        ))}
        {org?.is_demo && (
          <div className="mt-2 rounded-[12px] border border-warn/30 bg-warn/[0.06] px-3 py-2.5 text-[12.5px] leading-snug text-warn">
            Demo company. Data resets; nothing here is real.
          </div>
        )}
      </div>
    </div>
  );
}

function Topbar({ me }: { me: Me | null }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-5 md:px-8">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <IconButton label="Open navigation" className="lg:hidden">
              <MenuIcon className="size-4" />
            </IconButton>
          </SheetTrigger>
          <SheetContent side="left" title="Navigation" className="w-[300px]">
            <Sidebar me={me} onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <Link href="/app" className="hidden sm:block lg:hidden" aria-label="Overview">
          <Logo colour className="size-7" />
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          {me && <WalletMenu me={me} />}
          {me && <NotificationsBell />}
          {me && <UserMenu me={me} />}
        </div>
      </div>
    </header>
  );
}

function NotificationsBell() {
  const q = useNotifications();
  const unread = (q.data ?? []).filter((n) => !n.read_at);
  const markRead = useMarkRead();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <IconButton label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"}>
          <Bell className="size-4" />
          {unread.length > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-ember-1 ring-2 ring-black" />}
        </IconButton>
      </SheetTrigger>
      <SheetContent title="Notifications" description={unread.length ? `${unread.length} unread` : "You're all caught up"}>
        <div className="flex justify-end px-5 pt-3">
          {unread.length > 0 && (
            <button
              type="button"
              onClick={() => markRead.mutate(unread.map((n) => n.id))}
              className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink"
            >
              <CheckCheck className="size-4" /> Mark all read
            </button>
          )}
        </div>
        <NotificationList query={q} compact />
      </SheetContent>
    </Sheet>
  );
}

export function NotificationList({
  query,
  compact = false,
}: {
  query: { data?: Notification[]; isPending: boolean; error: unknown; refetch: () => unknown };
  compact?: boolean;
}) {
  if (query.isPending)
    return (
      <div className="space-y-3 p-5">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-[14px]" />
        ))}
      </div>
    );
  if (query.error) return <div className="p-5"><ErrorState error={query.error} onRetry={() => query.refetch()} compact /></div>;
  const items = query.data ?? [];
  if (!items.length)
    return (
      <div className={compact ? "p-5" : ""}>
        <EmptyState
          icon={<Bell />}
          title="No notifications yet"
          body="You'll hear about application decisions, drawdowns, weekly settlements and anything that needs your attention."
        />
      </div>
    );
  return (
    <ul className={cn("divide-y divide-line", compact && "px-2")}>
      {items.map((n) => {
        const inner = (
          <div className="flex gap-3 px-3 py-4">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-ember-1")} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("text-[14px]", n.read_at ? "text-ink-2" : "text-ink")}>{n.title}</p>
                <span className="shrink-0 text-[12px] text-ink-3">{relative(n.created_at)}</span>
              </div>
              {n.body && <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{n.body}</p>}
            </div>
          </div>
        );
        return (
          <li key={n.id}>
            {n.href ? (
              <Link href={n.href} className="block rounded-[14px] transition hover:bg-white/[0.03]">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}

function UserMenu({ me }: { me: Me }) {
  const router = useRouter();
  const qc = useQueryClient();
  const logout = useLogout();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white/[0.03] pl-1 pr-3 transition hover:border-line-strong"
          aria-label="Account menu"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2a2a2e,#151517)] text-[12px] text-ink">
            {me.user.name
              .split(/\s+/)
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || <UserRound className="size-4" />}
          </span>
          <span className="hidden max-w-[120px] truncate text-[13.5px] text-ink md:inline">{me.user.name.split(" ")[0]}</span>
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>
          <div className="text-[14px] text-ink">{me.user.name}</div>
          <div className="truncate text-[12.5px] text-ink-3">{me.user.email}</div>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem icon={<Settings />} onSelect={() => router.push("/app/settings")}>
          Settings
        </MenuItem>
        {me.org?.kind === "LENDER" && (
          <MenuItem icon={<Globe />} onSelect={() => router.push(`/lenders/${me.org!.slug}`)}>
            Public profile
          </MenuItem>
        )}
        <MenuItem icon={<BookOpen />} onSelect={() => router.push("/docs")}>
          Docs
        </MenuItem>
        <MenuItem icon={<ExternalLink />} onSelect={() => router.push("/explorer")}>
          Public explorer
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<LogOut />}
          danger
          onSelect={() =>
            logout.mutate(undefined, {
              onSettled: () => {
                qc.clear();
                router.replace("/login");
              },
            })
          }
        >
          Log out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-56 rounded-[28px]" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36 rounded-[20px]" />
        <Skeleton className="h-36 rounded-[20px]" />
        <Skeleton className="h-36 rounded-[20px]" />
      </div>
    </div>
  );
}
