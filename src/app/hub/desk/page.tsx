import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { HubPage } from "@/components/hub/hub-page";
import { DeskProvider } from "@/components/hub/desk/desk-context";
import { DeskForm } from "@/components/hub/desk/desk-form";
import { DeskRail } from "@/components/hub/desk/desk-rail";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts/routes";
import { loadBarangays } from "@/lib/hub/barangay-geojson";
import { readBarangays, recentDesk, stayingOptions } from "@/lib/hub/desk";
import { getMapBbox } from "@/lib/hub/map-pins";

export const metadata: Metadata = { title: "Help desk" };

// The recent list changes with every report the desk files.
export const dynamic = "force-dynamic";

export default async function HelpDeskPage() {
  // Recent shows report codes, which open a family's report, so the page is staff only.
  // src/proxy.ts redirects first; this check does not rely on it.
  const session = await readSession("staff", (await cookies()).get(SESSION_COOKIE.staff)?.value);
  if (!session) redirect(routes.hub.lock);

  return (
    <DeskProvider>
      <HubPage title="Help desk" active={routes.hub.desk} rail={<DeskRail recent={recentDesk(db)} />}>
        <DeskForm barangays={readBarangays(db)} staying={stayingOptions(db)} bbox={getMapBbox(db)} outlines={loadBarangays()} />
      </HubPage>
    </DeskProvider>
  );
}
