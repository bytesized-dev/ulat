import type { HubStatus } from "@/lib/contracts";

/** The banner shows below this percent. */
export const LOW_BATTERY_PERCENT = 20;

/**
 * True when the hub reports a battery under 20% and is not charging. An unknown
 * reading never warns. An unknown charging state does, because on a dying battery a
 * false warning costs less than a missing one.
 */
export function isLowBattery(status: Pick<HubStatus, "battery_percent" | "charging"> | null | undefined): boolean {
  if (!status || status.battery_percent === null) return false;
  return status.battery_percent < LOW_BATTERY_PERCENT && status.charging !== true;
}
