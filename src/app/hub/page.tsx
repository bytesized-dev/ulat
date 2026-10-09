import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HubPage } from "@/components/hub/hub-page";
import { OverviewMain, OverviewRailLive } from "@/components/hub/overview/overview-main";
import { OverviewLive } from "@/components/hub/overview/use-hub-summary";
import { db } from "@/db/client";
import { readSetting } from "@/lib/auth/settings";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts/routes";
import { getLatest } from "@/lib/hub/latest";
import { getMapBbox, getMapPins } from "@/lib/hub/map-pins";
import { getHubSummary } from "@/lib/hub/summary";

export const metadata: Metadata = { title: "Overview" };

// Reads the database on every request. OverviewLive keeps it fresh after that.
export const dynamic = "force-dynamic";

export default async function HubOverviewPage() {
  // Latest names households, so the page is staff only, like GET /api/hub/summary.
  // src/proxy.ts redirects first; this check does not rely on it.
  const session = await readSession("staff", (await cookies()).get(SESSION_COOKIE.staff)?.value);
  if (!session) redirect(routes.hub.lock);

  const summary = getHubSummary(db);
  const latest = getLatest(db);
  const map = { bbox: getMapBbox(db), pins: getMapPins(db) };
  const wifiName = readSetting("wifi_name") ?? "ULAT-HUB";

  return (
    <HubPage
      title="Overview"
      active={routes.hub.overview}
      rail={<OverviewRailLive summary={summary} latest={latest} wifiName={wifiName} />}
    >
      <OverviewLive />
      <OverviewMain summary={summary} map={map} />
    </HubPage>
  );
}
