// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../../db/client";
import { freshDb } from "./test-setup";
import { listUpdates } from "./updates";

let db: Db;
let schema: typeof import("@/db/schema");

beforeAll(async () => {
  ({ db, schema } = await freshDb("hub-updates"));
});

const row = (headline: string, posted_at: string, expires_at: string | null = null) => ({
  type: "notice" as const,
  headline,
  message: "",
  posted_at,
  expires_at,
});

describe("listUpdates", () => {
  it("lists active updates newest first and leaves out expired ones", () => {
    db.insert(schema.updates)
      .values([
        row("First", "2026-10-09T04:00:00.000Z"),
        row("Second", "2026-10-09T05:00:00.000Z", "2026-10-09T09:00:00.000Z"),
        row("Expired", "2026-10-09T06:00:00.000Z", "2026-10-09T07:00:00.000Z"),
      ])
      .run();
    expect(listUpdates(db, "2026-10-09T08:00:00.000Z").map((u) => u.headline)).toEqual(["Second", "First"]);
  });
});
