import type { BarangayCollection } from "@/components/map";
import { tilesBounds } from "@/lib/hub/map-assets";
import { inRing, type LngLat } from "@/lib/hub/map-projection";
import type { ReportDraft } from "./report-draft";

// The family sets their home by GPS or by moving the map under a center pin.
// Everything here is plain logic, so the screen only has to wire it up.

const nameProperty = "name";

/** The barangay whose outline holds the point, or null when it is outside all of them. */
export function barangayAt(point: LngLat, barangays: BarangayCollection | undefined): string | null {
  for (const feature of barangays?.features ?? []) {
    const polygons =
      feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    // The first ring of each polygon is its outline. The rest are holes, which a town this size does not use.
    if (!polygons.some((polygon) => inRing(point, polygon[0]))) continue;
    const name = feature.properties[nameProperty];
    return typeof name === "string" && name !== "" ? name : null;
  }
  return null;
}

/** "San Isidro, Purok 3", or whichever half is known. */
export function placeLine(barangay: string | null, purok: string): string {
  const parts = [barangay, purok.trim()].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : "Not in a barangay";
}

/** A GPS fix outside the town map would leave the map with nothing to show, so it is ignored. */
export function insideTown(point: LngLat): boolean {
  const [west, south, east, north] = tilesBounds;
  return point.lng >= west && point.lng <= east && point.lat >= south && point.lat <= north;
}

/** The saved home, or null when the family has not picked one. */
export function savedHome(draft: Pick<ReportDraft, "lat" | "lng">): LngLat | null {
  return draft.lat !== null && draft.lng !== null ? { lat: draft.lat, lng: draft.lng } : null;
}

const sameName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;

/**
 * What Use this spot writes to the draft: the position, rounded to about a
 * tenth of a metre, and the barangay under the pin. The barangay is only
 * replaced when the hub lists it, using the hub's spelling. Otherwise the
 * family keeps the one they chose on the first step.
 */
export function homeChange(
  point: LngLat,
  barangay: string | null,
  hubBarangays: readonly string[],
): Pick<ReportDraft, "lat" | "lng"> & Partial<Pick<ReportDraft, "barangay">> {
  const change = { lat: Math.round(point.lat * 1e6) / 1e6, lng: Math.round(point.lng * 1e6) / 1e6 };
  const listed = barangay ? hubBarangays.find((name) => sameName(name, barangay)) : undefined;
  return listed ? { ...change, barangay: listed } : change;
}
