import { readFileSync } from "node:fs";
import { db } from "../src/db/client";
import { settings } from "../src/db/schema";

// Loads seed/simulation.json, the same data the canvas shows. BYT-1 seeds the
// settings table only. BYT-8 adds the other tables and hashes the PINs, so
// team_pin and staff_pin are skipped here.

const simulation = JSON.parse(readFileSync("seed/simulation.json", "utf8")) as {
  settings: Record<string, unknown>;
};

const skip = new Set(["team_pin", "staff_pin"]);

const rows = Object.entries(simulation.settings)
  .filter(([key]) => !skip.has(key))
  .map(([key, value]) => ({ key, value: typeof value === "string" ? value : JSON.stringify(value) }));

db.transaction((tx) => {
  for (const row of rows) {
    tx.insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: { value: row.value } }).run();
  }
});

console.log(`Seeded ${rows.length} settings.`);
