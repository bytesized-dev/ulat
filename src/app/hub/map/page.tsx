import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HubPage } from "@/components/hub/hub-page";
import { HubMapMain } from "@/components/hub/map/map-main";
import { HubMapProvider } from "@/components/hub/map/map-provider";
import { HubMapRail } from "@/components/hub/map/map-rail";
import { db } from "@/db/client";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts/routes";
import { getMapBbox, getMapPoints } from "@/lib/hub/map-pins";
import { getHubSummary } from "@/lib/hub/summary";

export const metadata: Metadata = { title: "Map" };

// Reads the database on every request. HubMapProvider asks for it again when a live event arrives.
export const dynamic = "force-dynamic";

export default async function HubMapPage() {
  // The pins name households, so the page is staff only. src/proxy.ts redirects
  // first; this check does not rely on it.
  const session = await readSession("staff", (await cookies()).get(SESSION_COOKIE.staff)?.value);
  if (!session) redirect(routes.hub.lock);

  return (
    <HubMapProvider bbox={getMapBbox(db)} points={getMapPoints(db)} rows={getHubSummary(db).barangays}>
      <HubPage title="Map" active={routes.hub.map} rail={<HubMapRail />}>
        <HubMapMain />
      </HubPage>
    </HubMapProvider>
  );
}
