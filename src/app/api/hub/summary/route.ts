import { db } from "@/db/client";
import { getHubSummary } from "@/lib/hub/summary";

// Totals, per barangay rows, priority and needs for the hub. Every number is
// computed in SQL by getHubSummary. Aggregates only, no names or locations.
// TODO: require the staff session once the auth API lands.

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getHubSummary(db));
}
