import { describe, expect, it } from "vitest";
import { parseUpdates } from "./updates";

const base = { type: "notice", headline: "Visits start", message: "Hurt or missing go first.", message_ceb: null };

describe("parseUpdates", () => {
  it("sorts newest first and ignores extra fields", () => {
    const body = {
      updates: [
        { ...base, id: "a", posted_at: "2026-10-10T04:20:00.000Z", seen_count: 3 },
        { ...base, id: "b", posted_at: "2026-10-10T06:30:00.000Z" },
      ],
    };
    expect(parseUpdates(body).map((u) => u.id)).toEqual(["b", "a"]);
  });

  it("skips items that do not fit", () => {
    const body = { updates: [{ ...base, id: "a", posted_at: "nope" }, { ...base, id: "b", type: "other", posted_at: "2026-10-10T06:30:00.000Z" }, { id: "c" }] };
    expect(parseUpdates(body)).toEqual([]);
  });

  it("gives an empty list for anything else", () => {
    expect(parseUpdates(null)).toEqual([]);
    expect(parseUpdates([])).toEqual([]);
    expect(parseUpdates({ updates: "x" })).toEqual([]);
  });
});
