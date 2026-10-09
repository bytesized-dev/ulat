import { expect, it, vi } from "vitest";

// The page checks for staff before it detects or reads anything. The guard is
// faked to refuse, and every read the page makes is a spy that must stay unused.
const spies = vi.hoisted(() => ({ detect: vi.fn(), list: vi.fn(), count: vi.fn(), bbox: vi.fn() }));
const requireStaffPage = vi.hoisted(() => vi.fn().mockRejectedValue(new Error("NEXT_REDIRECT /hub/lock")));

vi.mock("@/lib/hub/staff-page", () => ({ requireStaffPage }));
vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/hub/duplicates", () => ({ detectDuplicates: spies.detect, listOpenDuplicates: spies.list }));
vi.mock("@/lib/hub/family-reports", () => ({ countReview: spies.count }));
vi.mock("@/lib/hub/map-pins", () => ({ getMapBbox: spies.bbox }));

// The first import loads the whole hub page tree, which takes 5 to 8 seconds under load.
it("/hub/review/duplicates redirects before it reads anything", { timeout: 30_000 }, async () => {
  const page = (await import("./page")).default;
  await expect(page({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT /hub/lock");
  expect(requireStaffPage).toHaveBeenCalledOnce();
  for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled();
});
