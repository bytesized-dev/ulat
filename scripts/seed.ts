import { readFileSync } from "node:fs";
import { z } from "zod";
import { db } from "../src/db/client";
import { responders, settings } from "../src/db/schema";
import { hashPin } from "../src/lib/pin";

// Loads seed/config.json for db:seed: the town, its barangays, the map bbox,
// the staff PIN and the responder accounts. Settings are upserted by key and
// responders by email, so running it twice changes nothing. It never deletes
// or touches reports, entries or any other record.

const BBox = z.object({ west: z.number(), south: z.number(), east: z.number(), north: z.number() });

const Config = z.object({
  settings: z
    .object({
      town: z.string(),
      barangays: z.array(z.string()),
      map_bbox: BBox,
      // Plain here, hashed before it reaches the database.
      staff_pin: z.string().min(1),
    })
    .catchall(z.unknown()),
  responders: z.array(
    z.object({
      name: z.string(),
      team: z.string(),
      // Stored lower case, and the sign in matches it that way.
      email: z.email().transform((value) => value.toLowerCase()),
      // Plain here like staff_pin, hashed before it reaches the database.
      password: z.string().min(1),
    }),
  ),
});

const config = Config.parse(JSON.parse(readFileSync("seed/config.json", "utf8")));

function settingText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function main() {
  // Hash first. The transaction below is synchronous and must not wait.
  const settingRows = await Promise.all(
    Object.entries(config.settings).map(async ([key, value]) =>
      key === "staff_pin" ? { key: "staff_pin_hash", value: await hashPin(String(value)) } : { key, value: settingText(value) },
    ),
  );
  const responderRows = await Promise.all(
    config.responders.map(async (r) => ({ name: r.name, team: r.team, active: true, email: r.email, password_hash: await hashPin(r.password) })),
  );

  db.transaction((tx) => {
    for (const row of settingRows) {
      tx.insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: { value: row.value } }).run();
    }
    for (const row of responderRows) {
      const { name, team, active, password_hash } = row;
      tx.insert(responders).values(row).onConflictDoUpdate({ target: responders.email, set: { name, team, active, password_hash } }).run();
    }
  });

  console.log(`Loaded ${settingRows.length} settings and ${responderRows.length} responders for ${config.settings.town}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
