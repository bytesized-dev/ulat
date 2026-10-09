import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { databasePath } from "./path";
import * as schema from "./schema";

// One connection per server process. Next reloads modules in dev, so the
// handle lives on globalThis to avoid opening a new file handle per reload.

export type Db = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { ulatDb?: Db };

function open(): Db {
  mkdirSync(dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  // WAL lets the SSE stream read while a responder's entry is being written.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle({ client: sqlite, schema });
}

export const db: Db = (globalForDb.ulatDb ??= open());
