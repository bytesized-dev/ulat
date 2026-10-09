import { distanceMeters, formatDistance, type Point } from "./to-visit-order";

const POINTS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;

const rad = (d: number) => (d * Math.PI) / 180;

/** The compass point from one place to another, as in "north-east". */
export function compassPoint(from: Point, to: Point): (typeof POINTS)[number] {
  const dLng = rad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(rad(to.lat));
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) - Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(dLng);
  const degrees = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return POINTS[Math.round(degrees / 45) % 8];
}

/** "350 m north-east" for the bottom sheet. Without a position there is nothing to measure from. */
export function howFar(from: Point | null, to: Point | null): string | null {
  if (!from || !to) return null;
  return `${formatDistance(distanceMeters(from, to))} ${compassPoint(from, to)}`;
}

type BboxSetting = { west: number; south: number; east: number; north: number };

/** The map's box from the map_bbox setting, a JSON object of west, south, east and north. */
export function parseBbox(raw: string | undefined, fallback: BboxSetting): [number, number, number, number] {
  const use = (b: BboxSetting): [number, number, number, number] => [b.west, b.south, b.east, b.north];
  try {
    const b = JSON.parse(raw ?? "") as Record<string, unknown>;
    const { west, south, east, north } = b;
    if ([west, south, east, north].every((n) => typeof n === "number" && Number.isFinite(n)) && (west as number) < (east as number) && (south as number) < (north as number)) {
      return use(b as BboxSetting);
    }
  } catch {
    // Missing or not JSON: use the fallback below.
  }
  return use(fallback);
}
