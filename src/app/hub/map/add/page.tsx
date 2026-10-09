import type { Metadata } from "next";
import { routes } from "@/lib/contracts/routes";
import { HubShell } from "@/components/ui/hub-shell";
import { AddPointMap, AddPointProvider, AddPointRail } from "@/components/hub/map/add-point-view";
import { hubNav, hubStaff } from "@/components/hub/nav";

export const metadata: Metadata = { title: "Add a point" };
export const dynamic = "force-dynamic";

// src/proxy.ts keeps this page behind the staff PIN.
export default function AddPointPage() {
  return (
    <AddPointProvider>
      <HubShell title="Add a point" nav={hubNav} activeHref={routes.hub.map} {...hubStaff} rail={<AddPointRail />}>
        <AddPointMap />
      </HubShell>
    </AddPointProvider>
  );
}
