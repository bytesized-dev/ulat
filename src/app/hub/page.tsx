import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OverviewMain, OverviewRailLive } from "@/components/hub/overview/overview-main";
import { OverviewLive } from "@/components/hub/overview/use-hub-summary";
import { db } from "@/db/client";
import { readSetting } from "@/lib/auth/settings";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts/routes";
import { getLatest } from "@/lib/hub/latest";
import { getHubSummary } from "@/lib/hub/summary";

export const metadata: Metadata = { title: "Overview" };

// Reads the database on every request. OverviewLive keeps it fresh after that.
export const dynamic = "force-dynamic";

export default async function HubOverviewPage() {
  // Latest names households, so the page is staff only, like GET /api/hub/summary.
  const session = await readSession("staff", (await cookies()).get(SESSION_COOKIE.staff)?.value);
  if (!session) redirect(routes.hub.lock);

  const summary = getHubSummary(db);
  const latest = getLatest(db);
  const wifiName = readSetting("wifi_name") ?? "ULAT-HUB";

  // Interim frame with the same main and rail widths as HubShell. BYT-24 swaps
  // it for HubPage with rail={<OverviewRailLive … />}.
  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <OverviewLive />
      <main className="min-w-0 flex-1 p-8">
        <h1 className="sr-only">Overview</h1>
        <OverviewMain summary={summary} />
      </main>
      <aside aria-label="Details" className="w-80 shrink-0 border-l border-hairline p-6">
        <OverviewRailLive summary={summary} latest={latest} wifiName={wifiName} />
      </aside>
    </div>
  );
}
