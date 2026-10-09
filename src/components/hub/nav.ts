import {
  ClipboardCheck,
  Cpu,
  Headset,
  Inbox,
  LayoutGrid,
  Map,
  Megaphone,
  Settings,
  ShieldCheck,
  Table,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { routes } from "@/lib/contracts/routes";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shows the number of entries waiting for review. */
  showReviewCount?: boolean;
};

const { hub } = routes;

export const mainNav: NavItem[] = [
  { label: "Overview", href: hub.overview, icon: LayoutGrid },
  { label: "Review", href: hub.review, icon: Inbox, showReviewCount: true },
  { label: "Map", href: hub.map, icon: Map },
  { label: "Entries", href: hub.entries, icon: Table },
  { label: "Reports", href: hub.reports, icon: FileText },
  { label: "Updates", href: hub.updates, icon: Megaphone },
  { label: "Safe list", href: hub.safeList, icon: ShieldCheck },
  { label: "Help desk", href: hub.desk, icon: Headset },
];

export const kitNav: NavItem[] = [
  { label: "Before the storm", href: hub.checklist, icon: ClipboardCheck },
  { label: "Kit setup", href: hub.setup, icon: Settings },
  { label: "AI check", href: hub.aiCheck, icon: Cpu },
];

/** Whether a nav item is the current page. Overview matches only /hub itself. */
export function isActive(href: string, pathname: string): boolean {
  if (href === hub.overview) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The top bar title for a path: the nav label of the longest matching item. */
export function titleFor(pathname: string): string {
  const match = [...mainNav, ...kitNav]
    .filter((item) => isActive(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Overview";
}
