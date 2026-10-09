import { beforeEach, describe, expect, it, vi } from "vitest";

// The page checks staff first, then answers an unknown report with a 404.
const getPrintReport = vi.hoisted(() => vi.fn());
const requireStaffPage = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("@/lib/hub/staff-page", () => ({ requireStaffPage }));
vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/hub/print", () => ({ getPrintReport }));
vi.mock("next/navigation", () => ({ notFound }));

beforeEach(() => {
  for (const spy of [getPrintReport, requireStaffPage, notFound]) spy.mockClear();
  requireStaffPage.mockResolvedValue(undefined);
});

async function render(n: string) {
  const page = (await import("./page")).default;
  return page({ params: Promise.resolve({ n }) });
}

describe("/hub/reports/[n]/print", () => {
  it("is a 404 when there is no report with that number", async () => {
    getPrintReport.mockReturnValue(null);
    await expect(render("42")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getPrintReport).toHaveBeenCalledWith({}, "42");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("checks for staff before it reads the report", async () => {
    requireStaffPage.mockRejectedValue(new Error("NEXT_REDIRECT /hub/lock"));
    await expect(render("1")).rejects.toThrow("NEXT_REDIRECT /hub/lock");
    expect(getPrintReport).not.toHaveBeenCalled();
  });
});
