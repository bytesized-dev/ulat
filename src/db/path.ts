import { dirname, join } from "node:path";

// The SQLite file. drizzle.config.ts, the seed and the app all read it from
// here, so a worktree or a test can point at its own file with DATABASE_PATH.
export const databasePath = process.env.DATABASE_PATH ?? "data/ulat.db";

// Photos and audio at <uploads>/<yyyy-mm-dd>/<uuid>.<ext>, next to the database
// file (SPEC section 1).
export const uploadsPath = join(dirname(databasePath), "uploads");
