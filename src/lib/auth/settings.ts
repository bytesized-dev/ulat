import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings } from "@/db/schema";

/** One value from the settings table, or undefined when the key is missing. */
export function readSetting(key: string): string | undefined {
  return db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get()?.value;
}

/**
 * Store a value only when the key has none yet, then return what the table
 * holds. Two processes that race to create the key end up with the same value.
 */
export function readOrCreateSetting(key: string, create: () => string): string {
  db.insert(settings).values({ key, value: create() }).onConflictDoNothing().run();
  return readSetting(key)!;
}

/** Create or replace one value in the settings table. */
export function writeSetting(key: string, value: string): void {
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

/** Whether the hub is in simulation mode. SPEC section 10 stores it as the text true or false. */
export function isSimulation(): boolean {
  return readSetting("simulation") === "true";
}

export function setSimulation(on: boolean): void {
  writeSetting("simulation", on ? "true" : "false");
}
