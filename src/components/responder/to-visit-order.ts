export type Point = { lat: number; lng: number };

export type ToVisitReport = {
  code: string;
  household_head: string;
  barangay: string;
  purok: string | null;
  lat: number | null;
  lng: number | null;
  hurt: number;
  missing: number;
  created_at: string;
};

export type ToVisitItem = ToVisitReport & {
  /** Straight line metres from the responder, or null when either side has no GPS. */
  distance_m: number | null;
};

export type ToVisitSort = "urgent" | "nearest";

const EARTH_RADIUS_M = 6_371_000;

const rad = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceMeters(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 350 m, 1.2 km. Under 1 km it rounds to the nearest 10 m. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function isUrgent(report: Pick<ToVisitReport, "hurt" | "missing">): boolean {
  return report.hurt > 0 || report.missing > 0;
}

// A house with no distance goes after every house that has one, oldest report first.
function byDistance(a: ToVisitItem, b: ToVisitItem): number {
  if (a.distance_m === null && b.distance_m === null) return a.created_at.localeCompare(b.created_at);
  if (a.distance_m === null) return 1;
  if (b.distance_m === null) return -1;
  return a.distance_m - b.distance_m;
}

export function withDistance(reports: ToVisitReport[], from: Point | null): ToVisitItem[] {
  return reports.map((report) => ({
    ...report,
    distance_m: from && report.lat !== null && report.lng !== null ? distanceMeters(from, { lat: report.lat, lng: report.lng }) : null,
  }));
}

/** Urgent first puts hurt or missing on top, then sorts each group by distance. */
export function orderToVisit(items: ToVisitItem[], sort: ToVisitSort): ToVisitItem[] {
  return [...items].sort((a, b) => {
    if (sort === "urgent") {
      const urgent = Number(isUrgent(b)) - Number(isUrgent(a));
      if (urgent !== 0) return urgent;
    }
    return byDistance(a, b);
  });
}
