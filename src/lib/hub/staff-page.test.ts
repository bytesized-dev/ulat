import { beforeEach, describe, expect, it, vi } from "vitest";

// The cookie jar, the session check and the redirect are faked. redirect()
// throws in Next, so the fake does too, and a page stops there.
const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));
const readSession = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
);
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue.current ? { value: cookieValue.current } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", () => ({ readSession, SESSION_COOKIE: { staff: "ulat_staff", responder: "ulat_responder" } }));

import { requireStaffPage } from "./staff-page";

beforeEach(() => {
  cookieValue.current = undefined;
  readSession.mockReset();
  redirect.mockClear();
});

describe("requireStaffPage", () => {
  it("sends a visitor with no cookie to the lock screen", async () => {
    readSession.mockResolvedValue(null);
    await expect(requireStaffPage()).rejects.toThrow("NEXT_REDIRECT /hub/lock");
    expect(readSession).toHaveBeenCalledWith("staff", undefined);
  });

  it("sends a visitor whose cookie is not a staff session to the lock screen", async () => {
    cookieValue.current = "forged";
    readSession.mockResolvedValue(null);
    await expect(requireStaffPage()).rejects.toThrow("NEXT_REDIRECT /hub/lock");
    expect(readSession).toHaveBeenCalledWith("staff", "forged");
  });

  it("lets staff through", async () => {
    cookieValue.current = "signed";
    readSession.mockResolvedValue({ role: "staff", exp: Date.now() + 1000 });
    await expect(requireStaffPage()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
