// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pushSQLiteSchema } from "drizzle-kit/api";
import { beforeAll, describe, expect, it, vi } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "ulat-entries-bg-"));
process.env.DATABASE_PATH = join(dir, "test.db");
process.env.UPLOAD_DIR = join(dir, "uploads");

vi.mock("@/lib/auth/session", () => ({
  requireResponder: async () => ({ role: "responder", responder_id: "r1", name: "Ana", exp: Date.now() + 1000 }),
  requireStaff: async () => Response.json({ error: "unauthorized" }, { status: 401 }),
  requireResponderOrStaff: async () => ({ role: "responder", responder_id: "r1", name: "Ana", exp: Date.now() + 1000 }),
}));
// A draft that never finishes stands in for a slow model.
const drafting = vi.hoisted(() => ({ draftEntry: vi.fn() }));
vi.mock("@/lib/ai/draft-entry", () => drafting);

function postForm() {
  const form = new FormData();
  form.set(
    "meta",
    JSON.stringify({
      report_code: null, barangay: "Poblacion", purok: "Purok 2", household_head: "Dela Cruz",
      lat: 10.1, lng: 123.2, gps_accuracy_m: 8, photo_labels: ["front"],
    }),
  );
  form.append("photos", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "p.png", { type: "image/png" }));
  return new Request("http://hub/api/entries", { method: "POST", body: form });
}

describe("POST /api/entries", () => {
  let route: typeof import("./route");

  beforeAll(async () => {
    const sqlite = new Database(process.env.DATABASE_PATH!);
    const schema = await import("@/db/schema");
    const push = await pushSQLiteSchema(schema as unknown as Record<string, unknown>, drizzle({ client: sqlite }) as never);
    sqlite.exec(push.statementsToExecute.join(String.fromCharCode(10)));
    sqlite.close();
    const { db } = await import("@/db/client");
    db.insert(schema.responders).values({ id: "r1", name: "Ana", team: "A", active: true }).run();
    route = await import("./route");
  });

  it("returns as soon as the entry is saved, while the draft is still running", async () => {
    drafting.draftEntry.mockReturnValue(new Promise(() => {}));
    const res = await route.POST(postForm());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("draft");
    expect(body.entry.ai_class).toBeNull();
    expect(drafting.draftEntry).toHaveBeenCalledWith(body.id);
  });

  it("still returns 201 when the background draft throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    drafting.draftEntry.mockRejectedValue(new Error("boom"));
    const res = await route.POST(postForm());
    expect(res.status).toBe(201);
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    error.mockRestore();
  });
});
