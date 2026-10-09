import type { BarangayCollection, LegendItem, MapPin } from "@/components/map";
import { type Bbox, type Percent, fromPercent } from "@/lib/hub/map-projection";
import seed from "../../../../seed/simulation.json";

/*
  Stand-in data for the map check page, until the town is picked and
  scripts/map/fetch-map.sh has written public/map. The bbox is a placeholder,
  and the barangays are rough boxes laid out like the canvas. Pins are the seed
  positions, converted with the same math the seed will use.
*/

export const standInBbox: Bbox = [124.0, 10.0, 124.04, 10.03];

const boxes: Record<string, [x0: number, y0: number, x1: number, y1: number]> = {
  Mabini: [15, 4, 45, 31],
  "San Isidro": [45, 4, 74, 60],
  "Santa Cruz": [74, 6, 98, 60],
  Poblacion: [15, 31, 45, 62],
  "Bagong Silang": [15, 62, 50, 96],
  Rizal: [50, 60, 98, 96],
};

function lngLat(p: Percent): [number, number] {
  const { lng, lat } = fromPercent(p, standInBbox);
  return [lng, lat];
}

export const standInBarangays: BarangayCollection = {
  type: "FeatureCollection",
  features: Object.entries(boxes).map(([name, [x0, y0, x1, y1]]) => ({
    type: "Feature",
    properties: { name },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          lngLat({ x: x0, y: y0 }),
          lngLat({ x: x1, y: y0 }),
          lngLat({ x: x1, y: y1 }),
          lngLat({ x: x0, y: y1 }),
          lngLat({ x: x0, y: y0 }),
        ],
      ],
    },
  })),
};

function at(pos: number[]) {
  return fromPercent({ x: pos[0], y: pos[1] }, standInBbox);
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

/** Totally damaged confirmed entries per barangay, for the shading. */
export const totalsByBarangay: Record<string, number> = Object.fromEntries(
  Object.keys(boxes).map((name) => [
    name,
    confirmed.filter((e) => e.barangay === name && e.damage_class === "total").length,
  ]),
);

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
