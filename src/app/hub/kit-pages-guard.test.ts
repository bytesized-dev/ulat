import { beforeEach, describe, expect, it, vi } from "vitest";

// Each kit page must check for staff before it reads anything. The guard is
// faked to refuse, and every read the pages make is a spy that must stay unused.
const reads = vi.hoisted(() => ({
  readHubStatus: vi.fn(),
  readKitSetup: vi.fn(),
  readChecklist: vi.fn(),
  readEvalResults: vi.fn(),
  readSetting: vi.fn(),
}));
const requireStaffPage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hub/staff-page", () => ({ requireStaffPage }));
vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/status", () => ({ readHubStatus: reads.readHubStatus }));
vi.mock("@/lib/hub/setup", () => ({ readKitSetup: reads.readKitSetup }));
vi.mock("@/lib/hub/checklist", async (original) => ({ ...(await original<typeof import("@/lib/hub/checklist")>()), readChecklist: reads.readChecklist }));
vi.mock("@/lib/hub/ai-check", () => ({ readEvalResults: reads.readEvalResults }));
vi.mock("@/lib/auth/settings", () => ({ readSetting: reads.readSetting }));

const pages = {
  setup: () => import("./setup/page"),
  checklist: () => import("./checklist/page"),
  "ai-check": () => import("./ai-check/page"),
};

beforeEach(() => {
  for (const spy of Object.values(reads)) spy.mockReset();
  requireStaffPage.mockReset();
  requireStaffPage.mockRejectedValue(new Error("NEXT_REDIRECT /hub/lock"));
});

describe("kit pages", () => {
  for (const [name, load] of Object.entries(pages)) {
    it(`/hub/${name} redirects before it reads anything`, async () => {
      const page = (await load()).default;
      await expect(page()).rejects.toThrow("NEXT_REDIRECT /hub/lock");
      expect(requireStaffPage).toHaveBeenCalledOnce();
      for (const spy of Object.values(reads)) expect(spy).not.toHaveBeenCalled();
    });
  }
});
