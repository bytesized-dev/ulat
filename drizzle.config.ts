import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { defineConfig } from "drizzle-kit";
import { databasePath } from "./src/db/path";

// pnpm db:push writes the schema straight to the file. There are no migration
// files: the database is created fresh on the hub before each deployment.
mkdirSync(dirname(databasePath), { recursive: true });

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: databasePath },
  verbose: true,
});
