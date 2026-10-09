import { HubStatus } from "@/lib/contracts";
import { readSetting } from "@/lib/auth/settings";
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
