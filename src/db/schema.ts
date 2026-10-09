import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// docs/SPEC.md section 3. BYT-8 adds the other tables.

/** Hub settings as key and value. Lists and objects are stored as JSON. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
