import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "@/lib/hub/test-setup";

// The action runs on its own SQLite file. The session and the cache call are
// faked, because they need a request.
const requireStaff = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requireStaff }));
vi.mock("next/cache", () => ({ revalidatePath }));

let settings: typeof import("@/db/schema").settings;
let db: typeof import("@/db/client").db;
let setChecklistItemAction: typeof import("./actions").setChecklistItemAction;

beforeAll(async () => {
  const fresh = await freshDb("checklist-action");
  db = fresh.db;
  settings = fresh.schema.settings;
  ({ setChecklistItemAction } = await import("./actions"));
});

beforeEach(() => {
  requireStaff.mockReset();
  revalidatePath.mockReset();
  db.delete(settings).run();
});

const asStaff = () => requireStaff.mockResolvedValue({ role: "staff", exp: Date.now() + 1000 });

describe("setChecklistItemAction", () => {
  it("refuses without a staff session and writes nothing", async () => {
    requireStaff.mockResolvedValue(Response.json({ error: "unauthorized" }, { status: 401 }));
    expect(await setChecklistItemAction("town_map", true)).toEqual({ ok: false, error: "unauthorized" });
    expect(db.select().from(settings).all()).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("ticks an item for staff and refreshes the page", async () => {
    asStaff();
    expect(await setChecklistItemAction("town_map", true)).toEqual({ ok: true, done: 1, total: 8 });
    expect(revalidatePath).toHaveBeenCalledWith("/hub/checklist");
    expect(db.select().from(settings).all()).toHaveLength(1);
  });

  it("unticks an item", async () => {
    asStaff();
    await setChecklistItemAction("town_map", true);
    expect(await setChecklistItemAction("town_map", false)).toEqual({ ok: true, done: 0, total: 8 });
  });

  it("rejects an id or a value that the browser made up", async () => {
    asStaff();
    for (const [id, done] of [["simulation", true], ["", true], ["town_map", "yes"], ["town_map", undefined]] as const) {
      expect(await setChecklistItemAction(id, done as unknown as boolean)).toEqual({ ok: false, error: "invalid" });
    }
    expect(db.select().from(settings).all()).toHaveLength(0);
  });
});
