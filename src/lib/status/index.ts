import { HubStatus } from "@/lib/contracts";
import { readSetting } from "@/lib/auth/settings";
import { publish } from "@/lib/live/bus";
import { phoneCount } from "./phones";
import { readBattery, readInternet, readModelLoaded, readStorageFreeGb } from "./probes";

/**
 * The hub's state right now. The probes never throw, so a machine with no
 * pmset or no Ollama gets nulls and false instead of an error. The result is
 * checked against the HubStatus contract before it leaves.
 */
export async function readHubStatus(): Promise<HubStatus> {
  const [battery, modelLoaded, storageFreeGb, internet] = await Promise.all([
    readBattery(),
    readModelLoaded(),
    readStorageFreeGb(),
    readInternet(),
  ]);
  return HubStatus.parse({
    internet,
    phones: phoneCount(),
    battery_percent: battery.percent,
    charging: battery.charging,
    model_loaded: modelLoaded,
    storage_free_gb: storageFreeGb,
    simulation: readSetting("simulation") === "true",
  });
}

const TICK_MS = 30_000;

// One timer for the whole process, kept on globalThis like the subscribers in
// src/lib/live/bus.ts so a reload or a second route does not start another.
const globalForTicker = globalThis as unknown as { ulatStatusTicker?: NodeJS.Timeout };

/** Publishes hub.status on the live bus every 30 s. Calling it again does nothing. */
export function startStatusTicker(): void {
  if (globalForTicker.ulatStatusTicker) return;
  // Every probe stops within 1.5 s, so a read is over long before the next beat
  // and beats never overlap.
  const timer = setInterval(() => {
    readHubStatus()
      .then((status) => publish({ type: "hub.status", status }))
      .catch(() => {
        // A failed read skips this beat. The next one tries again.
      });
  }, TICK_MS);
  // The ticker never keeps the process alive.
  timer.unref();
  globalForTicker.ulatStatusTicker = timer;
}
