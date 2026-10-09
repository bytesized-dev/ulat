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
  /** Who the hub assigned this report to. Left out where the list does not need it. */
  assigned_to?: string | null;
  assignee_name?: string | null;
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
  const nearest10 = Math.round(meters / 10) * 10;
  if (nearest10 < 1000) return `${nearest10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const OTHER_RESPONDER = "Another responder";

export type Assignment = { kind: "mine" } | { kind: "other"; name: string };

/** Whether the report is assigned to this responder, to someone else, or to nobody. */
export function assignmentOf(report: Pick<ToVisitReport, "assigned_to" | "assignee_name">, responderId: string): Assignment | null {
  if (!report.assigned_to) return null;
  if (report.assigned_to === responderId) return { kind: "mine" };
  return { kind: "other", name: report.assignee_name ?? OTHER_RESPONDER };
}

/** "Yours" on a row, or the name of whoever has it. */
export function assignmentTag(assignment: Assignment): string {
  return assignment.kind === "mine" ? "Yours" : assignment.name;
}

/** "Assigned to you" or "Assigned to Carlo Mendoza", for the report page. */
export function assignmentLabel(assignment: Assignment): string {
  return assignment.kind === "mine" ? "Assigned to you" : `Assigned to ${assignment.name === OTHER_RESPONDER ? "another responder" : assignment.name}`;
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

/**
 * Urgent first puts hurt or missing on top, then this responder's own reports,
 * then sorts each group by distance. Nearest ignores both.
 */
export function orderToVisit(items: ToVisitItem[], sort: ToVisitSort, responderId?: string): ToVisitItem[] {
  const mine = (item: ToVisitItem) => responderId !== undefined && item.assigned_to === responderId;
  return [...items].sort((a, b) => {
    if (sort === "urgent") {
      const urgent = Number(isUrgent(b)) - Number(isUrgent(a));
      if (urgent !== 0) return urgent;
      const own = Number(mine(b)) - Number(mine(a));
      if (own !== 0) return own;
    }
    return byDistance(a, b);
  });
}

/** Keeps houses whose household, barangay, purok or code contains every word typed. */
export function filterToVisit(items: ToVisitItem[], query: string): ToVisitItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const text = [item.household_head, item.barangay, item.purok ?? "", item.code].join(" ").toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** The responder's on and off filters. Both on keeps reports that pass both. */
export type VisitFilters = { mine: boolean; area: boolean };

export const NO_FILTERS: VisitFilters = { mine: false, area: false };

/** Keeps reports assigned to this responder, in their team's barangay, or both, as the filters say. */
export function filterByAssignment<T extends Pick<ToVisitReport, "assigned_to" | "barangay">>(
  items: T[],
  filters: VisitFilters,
  responderId: string,
  team: string | null,
): T[] {
  return items.filter(
    (item) => (!filters.mine || item.assigned_to === responderId) && (!filters.area || !team || item.barangay === team),
  );
}

export const MOVE_THRESHOLD_M = 25;

/** The position the list should use next. It ignores small drifts so rows do not shift while the responder walks. */
export function nextPosition(current: Point | null, fix: Point): Point {
  if (current === null) return fix;
  return distanceMeters(current, fix) >= MOVE_THRESHOLD_M ? fix : current;
}
