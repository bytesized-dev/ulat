import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BarangayCollection, LegendItem, MapPin } from "@/components/map";
import { barangayNameProperty, mapAssets } from "@/lib/hub/map-assets";
import { type Bbox, type LngLat, fromPercent, inRing } from "@/lib/hub/map-projection";
import seed from "../../../../seed/simulation.json";

/*
  Data for the map check page: the real Dapitan City barangays from
  public/map, and the seed's pins placed over the poblacion. Seed positions
  are percentages of the map area, so they need a bbox to land somewhere. This
  one stands in for the map_bbox setting until the seed sets it (BYT-8).
*/

/** Around the Dapitan City poblacion, about 4 km across. */
export const demoBbox: Bbox = [123.405, 8.635, 123.445, 8.675];

export function loadBarangays(): BarangayCollection {
  return JSON.parse(readFileSync(join(process.cwd(), "public", mapAssets.barangays), "utf8"));
}

function at(pos: number[]): LngLat {
  return fromPercent({ x: pos[0], y: pos[1] }, demoBbox);
}

const confirmed = seed.entries.filter((e) => e.status === "confirmed");

export const damagePins: MapPin[] = confirmed
  .filter((e) => e.damage_class === "total" || e.damage_class === "partial")
  .map((e) => ({
    id: `entry-${e.number}`,
    kind: e.damage_class as "total" | "partial",
    label: `${e.household_head}, ${e.damage_class === "total" ? "totally damaged" : "partially damaged"}`,
    ...at(e.pos),
  }));

export const reportPins: MapPin[] = seed.reports
  .filter((r) => ["waiting", "assigned", "on_the_way"].includes(r.status))
  .map((r) => ({ id: `report-${r.code}`, kind: "unvisited", label: `${r.household_head}, not visited`, ...at(r.pos) }));

export const placePins: MapPin[] = seed.places.map((p, i) => ({
  id: `place-${i}`,
  kind: p.type as "relief" | "shelter" | "hazard",
  label: p.name,
  ...at(p.pos),
}));

export const youPin: MapPin = { id: "you", kind: "you", label: "You", ...at([40, 62]) };

/**
 * Totally damaged pins per real barangay, found by where each pin falls. The
 * product counts by each entry's barangay field in SQL instead; the seed's
 * placeholder barangay names do not match Dapitan's yet.
 */
export function totalsByBarangay(barangays: BarangayCollection): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const feature of barangays.features) {
    const name = String(feature.properties[barangayNameProperty]);
    const rings =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates[0]]
        : feature.geometry.coordinates.map((polygon) => polygon[0]);
    totals[name] = damagePins.filter((p) => p.kind === "total" && rings.some((ring) => inRing(p, ring))).length;
  }
  return totals;
}

export const legends: Record<"hub" | "family" | "responder", LegendItem[]> = {
  hub: [
    { kind: "shade", label: "More damage" },
    { kind: "total", label: "Totally" },
    { kind: "partial", label: "Partially" },
    { kind: "unvisited", label: "Not visited" },
    { kind: "relief", label: "Relief" },
    { kind: "shelter", label: "Shelter" },
    { kind: "hazard", label: "Hazard" },
  ],
  family: [
    { kind: "relief", label: "Water or food" },
    { kind: "shelter", label: "Shelter" },
    { kind: "hazard", label: "Hazard" },
  ],
  responder: [
    { kind: "unvisited", label: "Report" },
    { kind: "total", label: "Totally" },
    { kind: "partial", label: "Partially" },
    { kind: "you", label: "You" },
  ],
};
