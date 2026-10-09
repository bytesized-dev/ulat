import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";

// The cookie is signed and well formed, but readActiveResponder says the
// responder is switched off or gone. The page must show the form. A redirect
// to /r here sends the phone back to sign in again, in a loop.

const jar = vi.hoisted(() => new Map<string, string>());
const readActiveResponder = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
);

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/auth/session")>()), readActiveResponder }));
// The page no longer opens the database. A call to it would fail this test.
vi.mock("@/db/client", () => ({
  get db() {
    throw new Error("the sign in page must not read the database");
  },
}));

import { SignInForm } from "@/components/responder/sign-in-form";
import ResponderSignInPage from "./page";

beforeEach(() => {
  jar.clear();
  readActiveResponder.mockReset();
  redirect.mockClear();
});

describe("responder sign in page", () => {
  it("renders the form, not a redirect, when the cookie belongs to an inactive responder", async () => {
    jar.set(SESSION_COOKIE.responder, "stale-token");
    readActiveResponder.mockResolvedValue(null);

    const page = (await ResponderSignInPage()) as { type: unknown; props: object };

    expect(readActiveResponder).toHaveBeenCalledWith("stale-token");
    expect(redirect).not.toHaveBeenCalled();
    expect(page.type).toBe(SignInForm);
    // No names to pick from, the form asks for an email.
    expect(page.props).toEqual({});
  });

  it("renders the form when there is no cookie", async () => {
    readActiveResponder.mockResolvedValue(null);
    const page = (await ResponderSignInPage()) as { type: unknown };
    expect(readActiveResponder).toHaveBeenCalledWith(undefined);
    expect(page.type).toBe(SignInForm);
  });

  it("sends an active responder on to the to visit list", async () => {
    jar.set(SESSION_COOKIE.responder, "good-token");
    readActiveResponder.mockResolvedValue({ role: "responder", responder_id: "r1", name: "Mae Santos" });
    await expect(ResponderSignInPage()).rejects.toThrow(`NEXT_REDIRECT ${routes.responder.toVisit}`);
  });
});
