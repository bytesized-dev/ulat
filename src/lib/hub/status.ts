import { HubStatus } from "@/lib/contracts";

export const statusUrl = "/api/hub/status";

// TODO(BYT-55): remove once GET /api/hub/status exists. Until then a 404 shows
// these placeholder values so the shell can be built and checked.
export const placeholderStatus: HubStatus = {
  internet: false,
  phones: 9,
  battery_percent: 68,
  charging: null,
  model_loaded: true,
  storage_free_gb: null,
  simulation: true,
};

/** Reads the hub status. Returns null when the hub can't be reached or the reply is invalid. */
export async function fetchHubStatus(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<HubStatus | null> {
  try {
    const res = await fetchImpl(statusUrl, { cache: "no-store", signal });
    if (res.status === 404) return placeholderStatus;
    if (!res.ok) return null;
    const parsed = HubStatus.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function formatBattery(percent: number | null | undefined): string {
  return typeof percent === "number" ? `${percent}%` : "Unknown";
}
