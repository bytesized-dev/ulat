import { count, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { entries, reports } from "../src/db/schema";
import { isSimulation, setSimulation } from "../src/lib/auth/settings";
import { clearData } from "../src/lib/clear-data/clear";
import { loadSeed } from "./seed-load";

// Puts the hub in the demo starting state: every data table and upload wiped,
// seed/simulation.json loaded, simulation mode on. Running it twice gives the
// same counts. Stop the hub first or restart it after, so open pages reload.

async function main() {
  const cleared = clearData();
  console.log(`Cleared ${Object.entries(cleared).map(([table, n]) => `${n} ${table}`).join(", ")}.`);
  await loadSeed();
  setSimulation(true);

  const confirmed = db.select({ n: count() }).from(entries).where(eq(entries.status, "confirmed")).get()?.n;
  const allReports = db.select({ n: count() }).from(reports).get()?.n;
  console.log(`Demo state ready: ${confirmed} confirmed houses, ${allReports} reports, simulation ${isSimulation() ? "on" : "off"}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
