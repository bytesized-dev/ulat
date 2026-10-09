// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { freshDb } from "@/lib/hub/test-setup";

// The confirmed page says "Entry confirmed" only for a confirmed entry. A held
// entry says it was sent for a second look.

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

let db: Awaited<ReturnType<typeof freshDb>>["db"];
let schema: Awaited<ReturnType<typeof freshDb>>["schema"];
let responderId: string;

beforeAll(async () => {
  ({ db, schema } = await freshDb("confirmed-page"));
  responderId = db.insert(schema.responders).values({ name: "Jun Reyes" }).returning().get().id;
}, 30_000);

let number = 1;
const entry = (status: "needs_review" | "confirmed") =>
  db
    .insert(schema.entries)
    .values({
      number: number++,
      responder_id: responderId,
      barangay: "Sinonoc",
      household_head: "Santos",
      damage_class: "total",
      people: 6,
      hurt: 1,
      status,
      created_at: "2026-10-10T06:51:00.000Z",
    })
    .returning()
    .get().id;

async function render(id: string) {
  const page = (await import("./page")).default;
  return renderToStaticMarkup(await page({ params: Promise.resolve({ entryId: id }) }));
}

describe("/r/assess/[entryId]/confirmed", () => {
  it("says Entry confirmed for a confirmed entry", async () => {
    const html = await render(entry("confirmed"));
    expect(html).toContain("Entry confirmed");
    expect(html).toContain("6 people, 1 hurt");
    expect(html).not.toContain("second look");
  }, 30_000);

  it("says Sent for a second look for a needs_review entry, and keeps the household row and buttons", async () => {
    const html = await render(entry("needs_review"));
    expect(html).toContain("Sent for a second look");
    expect(html).toContain("Staff at the hub will check it before it counts.");
    expect(html).not.toContain("Entry confirmed");
    expect(html).toContain("6 people, 1 hurt");
    expect(html).toContain("Back to list");
  }, 30_000);
});
