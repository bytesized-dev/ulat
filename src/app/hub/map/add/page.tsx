import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import type { BarangayCollection, MapPin } from "@/components/map";
import { HubPage } from "@/components/hub/hub-page";
import { AddPointMap, AddPointProvider, AddPointRail } from "@/components/hub/map/add-point-view";
import { parseBbox } from "@/components/responder/map-sheet";
import { map } from "@/config";
import { db } from "@/db/client";
import { places } from "@/db/schema";
import { readSetting } from "@/lib/auth/settings";
import { routes } from "@/lib/contracts/routes";
import { mapAssets } from "@/lib/hub/map-assets";

export const metadata: Metadata = { title: "Add a point" };
export const dynamic = "force-dynamic";

function loadBarangays(): BarangayCollection | undefined {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", mapAssets.barangays), "utf8"));
  } catch {
    return undefined;
  }
}

// src/proxy.ts keeps this page behind the staff PIN.
export default function AddPointPage() {
  const pins: MapPin[] = db
    .select({ id: places.id, type: places.type, name: places.name, lat: places.lat, lng: places.lng })
    .from(places)
    .all()
    .map((p) => ({ id: p.id, kind: p.type, label: p.name, lat: p.lat, lng: p.lng }));
  return (
    <AddPointProvider>
      <HubPage title="Add a point" active={routes.hub.map} rail={<AddPointRail />}>
        <AddPointMap bbox={parseBbox(readSetting("map_bbox"), map.placeholderBbox)} barangays={loadBarangays()} pins={pins} />
      </HubPage>
    </AddPointProvider>
  );
}
