// The SQLite file. drizzle.config.ts, the seed and the app all read it from
// here, so a worktree or a test can point at its own file with DATABASE_PATH.
export const databasePath = process.env.DATABASE_PATH ?? "data/ulat.db";
