import { beforeEach, describe, expect, it, vi } from "vitest";

// The guard is what is under test, so the session, the database work and the
// cache call are faked and the action never opens data/ulat.db.
const requireStaff = vi.hoisted(() => vi.fn());
const clearData = vi.hoisted(() => vi.fn());
const setSimulation = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requireStaff }));
vi.mock("@/lib/auth/settings", () => ({ setSimulation }));
vi.mock("./clear", () => ({ clearData }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { clearDataAction, setSimulationAction } from "./actions";

beforeEach(() => {
  requireStaff.mockReset();
  clearData.mockReset();
  setSimulation.mockReset();
});

describe("Kit setup actions", () => {
  it("refuse without a staff session and change nothing", async () => {
    requireStaff.mockResolvedValue(Response.json({ error: "unauthorized" }, { status: 401 }));
    expect(await clearDataAction()).toEqual({ ok: false, error: "unauthorized" });
    expect(await setSimulationAction(true)).toEqual({ ok: false, error: "unauthorized" });
    expect(clearData).not.toHaveBeenCalled();
    expect(setSimulation).not.toHaveBeenCalled();
  });

  it("run for staff", async () => {
    requireStaff.mockResolvedValue({ role: "staff", exp: Date.now() + 1000 });
    clearData.mockReturnValue({ reports: 3 });
    expect(await clearDataAction()).toEqual({ ok: true, cleared: { reports: 3 } });
    expect(await setSimulationAction(false)).toEqual({ ok: true });
    expect(setSimulation).toHaveBeenCalledWith(false);
  });

  it("reject a simulation value that is not a boolean", async () => {
    requireStaff.mockResolvedValue({ role: "staff", exp: Date.now() + 1000 });
    for (const bad of ["false", 0, null, undefined, {}]) {
      expect(await setSimulationAction(bad as unknown as boolean)).toEqual({ ok: false, error: "invalid" });
    }
    expect(setSimulation).not.toHaveBeenCalled();
  });
});
