import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { HomeLocationForm } from "@/components/family/home-location-form";
import type { BarangayCollection } from "@/components/map";
import { parseBbox } from "@/components/responder/map-sheet";
import { map } from "@/config";
import { readSetting } from "@/lib/auth/settings";
import { mapAssets } from "@/lib/hub/map-assets";
import { parseBarangays } from "../parse-barangays";

export const metadata: Metadata = { title: "Location" };

// The map area and the barangay list are set on the hub, so the page is built
// for each request instead of once at build time.
export const dynamic = "force-dynamic";

function loadBarangays(): BarangayCollection | undefined {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", mapAssets.barangays), "utf8"));
  } catch {
    return undefined;
  }
}

export default function HomeLocationPage() {
  return (
    <HomeLocationForm
      bbox={parseBbox(readSetting("map_bbox"), map.placeholderBbox)}
      barangays={loadBarangays()}
      hubBarangays={parseBarangays(readSetting("barangays"))}
    />
  );
}
