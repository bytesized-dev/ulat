import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BarangayCollection } from "@/components/map";
import { mapAssets } from "./map-assets";

/**
 * The barangay outlines the hub serves from public/map, read for a page that
 * hands them to MapView. Server only. A missing or broken file gives nothing,
 * and the map draws without outlines.
 */
export function loadBarangays(): BarangayCollection | undefined {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", mapAssets.barangays), "utf8"));
  } catch {
    return undefined;
  }
}
