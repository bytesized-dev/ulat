import { HubStatus } from "@/lib/contracts";

export const statusUrl = "/api/hub/status";

export type HubStatusResult = {
  /** The status, or null when the hub can't be reached or the reply is invalid. */
  status: HubStatus | null;
  /** The hub answered 401, so the staff session is gone. */
  unauthorized: boolean;
};

/** Reads the hub status and says whether the staff session was refused. */
export async function readHubStatus(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<HubStatusResult> {
  try {
    const res = await fetchImpl(statusUrl, { cache: "no-store", signal });
    if (res.status === 401) return { status: null, unauthorized: true };
    if (!res.ok) return { status: null, unauthorized: false };
    const parsed = HubStatus.safeParse(await res.json());
    return { status: parsed.success ? parsed.data : null, unauthorized: false };
  } catch {
    return { status: null, unauthorized: false };
  }
}

/** Reads the hub status. Returns null when the hub can't be reached or the reply is invalid. */
export async function fetchHubStatus(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<HubStatus | null> {
  return (await readHubStatus(fetchImpl, signal)).status;
}

export function formatBattery(percent: number | null | undefined): string {
  return typeof percent === "number" ? `${percent}%` : "Unknown";
}
