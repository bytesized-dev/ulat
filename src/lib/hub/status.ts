import { HubStatus } from "@/lib/contracts";

export const statusUrl = "/api/hub/status";

/** Reads the hub status. Returns null when the hub can't be reached or the reply is invalid. */
export async function fetchHubStatus(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<HubStatus | null> {
  try {
    const res = await fetchImpl(statusUrl, { cache: "no-store", signal });
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
