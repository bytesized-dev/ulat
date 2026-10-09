import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { FamilyMap } from "@/components/family/family-map";
import { parseMapBbox } from "@/components/family/map-places";
import type { BarangayCollection } from "@/components/map";
import { map } from "@/config";
import { readSetting } from "@/lib/auth/settings";
import { mapAssets } from "@/lib/hub/map-assets";

export const metadata: Metadata = { title: "Map" };

// The map box is set on the hub, so the page is built for each request.
export const dynamic = "force-dynamic";

function loadBarangays(): BarangayCollection | undefined {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", mapAssets.barangays), "utf8"));
  } catch {
    return undefined;
  }
}

export default function MapPage() {
  return <FamilyMap bbox={parseMapBbox(readSetting("map_bbox"), map.placeholderBbox)} barangays={loadBarangays()} />;
}
