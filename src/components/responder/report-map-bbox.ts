import { distanceMeters, type Point } from "./to-visit-order";

/** About 170 m each way, so a lone house is not drawn at the closest zoom. */
const MIN_HALF_SPAN = 0.0015;
/** Room around the two pins so neither sits on the edge. */
const MARGIN = 0.8;
/** Farther than this, the phone is not near the house yet, so the map shows the house alone. */
export const NEAR_METERS = 10_000;

/**
 * The view for one report: the house and, when the responder is near, the
 * responder too. West, south, east, north, as the map takes it.
 */
export function reportMapBbox(home: Point, you: Point | null): [number, number, number, number] {
  const points = you && distanceMeters(you, home) <= NEAR_METERS ? [home, you] : [home];
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const halfLat = Math.max(((Math.max(...lats) - Math.min(...lats)) / 2) * (1 + MARGIN), MIN_HALF_SPAN);
  const halfLng = Math.max(((Math.max(...lngs) - Math.min(...lngs)) / 2) * (1 + MARGIN), MIN_HALF_SPAN);
  return [midLng - halfLng, midLat - halfLat, midLng + halfLng, midLat + halfLat];
}
