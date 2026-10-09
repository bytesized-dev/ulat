// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import { freshDb } from "@/lib/hub/test-setup";

// Only a draft opens the check screen. A confirmed or held entry goes to the
// confirmed page, which says which of the two it is. The drafting page does the same.

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("@/lib/auth/session", () => ({ SESSION_COOKIE: { responder: "r" }, readActiveResponder: async () => ({ id: "r1" }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("@/components/responder/check-view", () => ({ CheckView: () => null }));
vi.mock("@/components/responder/drafting-view", () => ({ DraftingView: () => null }));

let db: Awaited<ReturnType<typeof freshDb>>["db"];
let schema: Awaited<ReturnType<typeof freshDb>>["schema"];
let responderId: string;

beforeAll(async () => {
  ({ db, schema } = await freshDb("check-page"));
  responderId = db.insert(schema.responders).values({ name: "Jun Reyes" }).returning().get().id;
}, 30_000);

let number = 1;
const entry = (status: "draft" | "needs_review" | "confirmed", ai_class: "partial" | null = "partial") =>
  db
    .insert(schema.entries)
    .values({ number: number++, responder_id: responderId, barangay: "Sinonoc", ai_class, status, created_at: "2026-10-10T06:51:00.000Z" })
    .returning()
    .get().id;

const check = async (id: string) => (await import("./page")).default({ params: Promise.resolve({ entryId: id }) });
const drafting = async (id: string) => (await import("../drafting/page")).default({ params: Promise.resolve({ entryId: id }) });

describe("/r/assess/[entryId]/check", () => {
  it.each(["needs_review", "confirmed"] as const)("sends a %s entry to the confirmed page", async (status) => {
    const id = entry(status);
    await expect(check(id)).rejects.toThrow(`NEXT_REDIRECT /r/assess/${id}/confirmed`);
  }, 30_000);

  it("sends a held entry to the confirmed page even when it has no AI class", async () => {
    const id = entry("needs_review", null);
    await expect(check(id)).rejects.toThrow(`NEXT_REDIRECT /r/assess/${id}/confirmed`);
  }, 30_000);

  it("opens the form for a draft the AI has read", async () => {
    await expect(check(entry("draft"))).resolves.toBeTruthy();
  }, 30_000);

  it("waits on the drafting screen for a draft the AI has not read yet", async () => {
    const id = entry("draft", null);
    await expect(check(id)).rejects.toThrow(`NEXT_REDIRECT /r/assess/${id}/drafting`);
  }, 30_000);
});

describe("/r/assess/[entryId]/drafting", () => {
  it.each(["needs_review", "confirmed"] as const)("sends a %s entry to the confirmed page", async (status) => {
    const id = entry(status);
    await expect(drafting(id)).rejects.toThrow(`NEXT_REDIRECT /r/assess/${id}/confirmed`);
  }, 30_000);

  it("shows the drafting screen for a draft, and for an id it cannot find", async () => {
    await expect(drafting(entry("draft", null))).resolves.toBeTruthy();
    await expect(drafting(crypto.randomUUID())).resolves.toBeTruthy();
  }, 30_000);
});
