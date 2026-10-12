import {
  ArrowLeftRight,
  Banknote,
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Inbox,
  LayoutGrid,
  Layers,
  LineChart,
  Settings,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { OrgKind } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short line for page headers and empty states. */
  blurb: string;
}

export const BORROWER_NAV: NavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutGrid, blurb: "Your balance, next installment and what to do next." },
  { href: "/app/revenue", label: "Revenue", icon: LineChart, blurb: "Connect where your revenue comes from." },
  { href: "/app/proofs", label: "Proofs", icon: FileCheck2, blurb: "Zero-knowledge proofs of your 90-day revenue." },
  { href: "/app/pools", label: "Pools", icon: Store, blurb: "Pools you can apply to, with their terms." },
  { href: "/app/applications", label: "Applications", icon: Inbox, blurb: "Where each application stands." },
  { href: "/app/loans", label: "Loans", icon: FileText, blurb: "Active and past loans, schedules and lockbox." },
  { href: "/app/payments", label: "Payments", icon: ArrowLeftRight, blurb: "Customer payments, installments and releases." },
];

export const LENDER_NAV: NavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutGrid, blurb: "Deployed capital, yield and alerts across your pools." },
  { href: "/app/my-pools", label: "My pools", icon: Layers, blurb: "Pools you manage: terms, capital and loans." },
  { href: "/app/review", label: "Review queue", icon: ClipboardCheck, blurb: "Applications waiting for your decision." },
  { href: "/app/portfolio", label: "Portfolio", icon: BriefcaseBusiness, blurb: "Your tranche positions and returns." },
  { href: "/app/funds", label: "Funds", icon: Banknote, blurb: "Deposit, withdraw and get test cUSD." },
];

export const SHARED_NAV: NavItem[] = [
  { href: "/app/notifications", label: "Notifications", icon: Bell, blurb: "Decisions, drawdowns, settlements and alerts." },
  { href: "/app/settings", label: "Settings", icon: Settings, blurb: "Profile, organization, wallets and security." },
];

export const SETTINGS_NAV = [
  { href: "/app/settings", label: "Profile" },
  { href: "/app/settings/organization", label: "Organization" },
  { href: "/app/settings/wallets", label: "Wallets" },
  { href: "/app/settings/security", label: "Security" },
];

export function navFor(kind: OrgKind | null | undefined): NavItem[] {
  return kind === "LENDER" ? LENDER_NAV : BORROWER_NAV;
}

export function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

