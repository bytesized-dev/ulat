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
import { routes } from "@/lib/contracts/routes";

const { hub } = routes;

/** The sidebar sections. The Review item shows how many entries wait for review. */
export function hubNav(reviewCount: number): HubNavSection[] {
  return [
    {
      items: [
        { label: "Overview", href: hub.overview, icon: <LayoutGridIcon /> },
        { label: "Review", href: hub.review, icon: <InboxIcon />, count: reviewCount, countLabel: "waiting" },
        { label: "Map", href: hub.map, icon: <MapIcon /> },
        { label: "Entries", href: hub.entries, icon: <TableIcon /> },
        { label: "Reports", href: hub.reports, icon: <FileTextIcon /> },
        { label: "Updates", href: hub.updates, icon: <MegaphoneIcon /> },
        { label: "Safe list", href: hub.safeList, icon: <ShieldCheckIcon /> },
        { label: "Help desk", href: hub.desk, icon: <HeadsetIcon /> },
      ],
    },
    {
      heading: "Kit",
      items: [
        { label: "Before the storm", href: hub.checklist, icon: <ClipboardCheckIcon /> },
        { label: "Kit setup", href: hub.setup, icon: <SettingsIcon /> },
        { label: "AI check", href: hub.aiCheck, icon: <CpuIcon /> },
      ],
    },
  ];
}
