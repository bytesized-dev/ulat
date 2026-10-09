import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { BarangayCollection } from "@/components/map";
import { LiveRefresh } from "@/components/responder/live-refresh";
import { MapScreen } from "@/components/responder/map-screen";
import { parseBbox } from "@/components/responder/map-sheet";
import { TabBar } from "@/components/ui/tab-bar";
import { map } from "@/config";
import { db } from "@/db/client";
import { entries, places, reports } from "@/db/schema";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { readSetting } from "@/lib/auth/settings";
import { routes } from "@/lib/contracts";
import { mapAssets } from "@/lib/hub/map-assets";

export const dynamic = "force-dynamic";

// "Not yet visited" in docs/SPEC.md section 6.
const OPEN_STATUSES = ["waiting", "assigned", "on_the_way"] as const;

function loadBarangays(): BarangayCollection | undefined {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", mapAssets.barangays), "utf8"));
  } catch {
    return undefined;
  }
}

export default async function MapPage() {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  const session = await readActiveResponder(token);
  if (!session) redirect(routes.responder.signIn);

  const open = db
    .select({
      code: reports.code,
      household_head: reports.household_head,
      barangay: reports.barangay,
      purok: reports.purok,
      lat: reports.lat,
      lng: reports.lng,
      hurt: reports.hurt,
      missing: reports.missing,
      created_at: reports.created_at,
    })
    .from(reports)
    .where(inArray(reports.status, OPEN_STATUSES))
    .all();

  // Confirmed houses with damage and a position. A house with no damage gets no pin.
  const confirmed = db
    .select({ id: entries.id, household_head: entries.household_head, damage_class: entries.damage_class, lat: entries.lat, lng: entries.lng })
    .from(entries)
    .where(and(inArray(entries.status, ["confirmed"]), isNotNull(entries.lat), isNotNull(entries.lng), inArray(entries.damage_class, ["partial", "total"])))
    .all()
    .map((e) => ({ id: e.id, household_head: e.household_head, damage_class: e.damage_class as "partial" | "total", lat: e.lat!, lng: e.lng! }));

  // The hazards the hub lists on /api/places for anyone. Hidden ones stay hidden, even to a laptop that also holds a staff session.
  const hazards = db
    .select({ id: places.id, name: places.name, details: places.details, lat: places.lat, lng: places.lng })
    .from(places)
    .where(and(eq(places.type, "hazard"), eq(places.visible, true)))
    .all();

  return (
    <div className="flex h-dvh flex-col">
      <MapScreen bbox={parseBbox(readSetting("map_bbox"), map.placeholderBbox)} barangays={loadBarangays()} reports={open} entries={confirmed} hazards={hazards} />
      <TabBar active="map" />
      <LiveRefresh />
    </div>
  );
}
