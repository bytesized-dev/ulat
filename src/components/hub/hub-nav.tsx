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
import type { HubNavSection } from "@/components/ui/hub-shell";
import { routes } from "@/lib/contracts";

// The hub sidebar. BYT-24 moves this into src/app/hub/layout.tsx with the
// status block. Until then each hub page passes it to HubShell itself.
export function hubNav(reviewCount: number): HubNavSection[] {
  return [
    {
      items: [
        { label: "Overview", href: routes.hub.overview, icon: <LayoutGridIcon /> },
        { label: "Review", href: routes.hub.review, icon: <InboxIcon />, count: reviewCount, countLabel: "waiting" },
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
}
