import {
  ClipboardCheckIcon,
  CpuIcon,
  FileTextIcon,
  HeadsetIcon,
  InboxIcon,
  LayoutGridIcon,
  MapIcon,
  MegaphoneIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TableIcon,
} from "lucide-react";
import { routes } from "@/lib/contracts/routes";
import type { HubNavSection } from "@/components/ui/hub-shell";

// The hub sidebar sections. BYT-24 (hub shell) owns the layout and will pass
// the Review count and the status block. Until then each page passes this to
// HubShell itself.
export const hubNav: HubNavSection[] = [
  {
    items: [
      { label: "Overview", href: routes.hub.overview, icon: <LayoutGridIcon /> },
      { label: "Review", href: routes.hub.review, icon: <InboxIcon /> },
      { label: "Map", href: routes.hub.map, icon: <MapIcon /> },
      { label: "Entries", href: routes.hub.entries, icon: <TableIcon /> },
      { label: "Reports", href: routes.hub.reports, icon: <FileTextIcon /> },
      { label: "Updates", href: routes.hub.updates, icon: <MegaphoneIcon /> },
      { label: "Safe list", href: routes.hub.safeList, icon: <ShieldCheckIcon /> },
      { label: "Help desk", href: routes.hub.desk, icon: <HeadsetIcon /> },
    ],
  },
  {
    heading: "Kit",
    items: [
      { label: "Before the storm", href: routes.hub.checklist, icon: <ClipboardCheckIcon /> },
      { label: "Kit setup", href: routes.hub.setup, icon: <SettingsIcon /> },
      { label: "AI check", href: routes.hub.aiCheck, icon: <CpuIcon /> },
    ],
  },
];

/** Who the hub avatar names. The hub has one staff role, not named users. */
export const hubStaff = { name: "MDRRMO staff", initials: "MD" };
