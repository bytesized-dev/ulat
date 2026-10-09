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
