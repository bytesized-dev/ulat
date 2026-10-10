// @vitest-environment node
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { freshDb, request, sessionMock } from "@/lib/hub/test-setup";

// storeUpload throws when a disk write fails instead of returning an error. The
// files stored before it must not stay behind with no row.

const dir = mkdtempSync(join(tmpdir(), "ulat-upload-throws-"));
process.env.UPLOAD_DIR = join(dir, "uploads");

const calls = vi.hoisted(() => ({ n: 0, failOn: 2 }));
vi.mock("@/lib/auth/session", async () => (await import("@/lib/hub/test-setup")).sessionMock);
vi.mock("@/lib/live/bus", async () => (await import("@/lib/hub/test-setup")).busMock);
vi.mock("./_lib/uploads", async (importOriginal) => {
  const real = await importOriginal<typeof import("./_lib/uploads")>();
  return {
    ...real,
    storeUpload: async (...args: Parameters<typeof real.storeUpload>) => {
      if (++calls.n === calls.failOn) throw new Error("ENOSPC");
      return real.storeUpload(...args);
    },
  };
});

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const files = () => (readdirSync(process.env.UPLOAD_DIR!, { recursive: true }) as string[]).filter((f) => /\.\w+$/.test(f)).length;

let route: typeof import("./route");
let db: Awaited<ReturnType<typeof freshDb>>["db"];
let schema: Awaited<ReturnType<typeof freshDb>>["schema"];

beforeAll(async () => {
  void sessionMock;
  ({ db, schema } = await freshDb("upload-throws"));
  db.insert(schema.responders).values({ id: "r1", name: "Ana" }).run();
  route = await import("./route");
}, 30_000);

describe("POST /api/entries when a file write throws", () => {
  it("deletes the files stored before it and writes no entry", async () => {
    const form = new FormData();
    form.set("meta", JSON.stringify({ report_code: null, barangay: "Poblacion", purok: null, household_head: null, lat: 10.1, lng: 123.2, gps_accuracy_m: 8, photo_labels: [], damage_class: "partial", material: "mixed", hazards: [], families: 1, people: 4, hurt: 0, missing: 0, needs: [] }));
    for (let i = 0; i < 2; i++) form.append("photos", new File([PNG], `p${i}.png`, { type: "image/png" }));
    const req = request("/api/entries", "responder", { method: "POST", body: form });
    await expect(route.POST(req)).rejects.toThrow("ENOSPC");
    expect(calls.n).toBe(2);
    expect(files()).toBe(0);
    expect(db.select().from(schema.entries).all()).toHaveLength(0);
  }, 30_000);
});
