import { describe, expect, it, vi } from "vitest";
import { initials, parseCheckedIn, parseFound, saveCheckedIn, searchUrl, sendCheckin, toCheckin } from "./safe-checkin";

const form = { name: "  Lourdes Ramos ", barangay: "Poblacion", staying_at: "At home", message: "  " };

describe("toCheckin", () => {
  it("trims, marks it as from a phone and sends no empty message", () => {
    const result = toCheckin(form);
    expect(result.success && result.data).toEqual({ name: "Lourdes Ramos", barangay: "Poblacion", staying_at: "At home", message: null, source: "phone" });
  });

  it("needs a name", () => {
    expect(toCheckin({ ...form, name: " " }).success).toBe(false);
  });
});

describe("sendCheckin", () => {
  it("posts to /api/safe", async () => {
    const send = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    expect(await sendCheckin(form, send)).toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith("/api/safe", expect.objectContaining({ method: "POST" }));
  });

  it("does not post an incomplete form", async () => {
    const send = vi.fn();
    expect((await sendCheckin({ ...form, name: "" }, send)).ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("says so when the hub cannot be reached or refuses", async () => {
    expect((await sendCheckin(form, vi.fn().mockRejectedValue(new Error("x")))).ok).toBe(false);
    expect((await sendCheckin(form, vi.fn().mockResolvedValue(new Response("", { status: 500 })))).ok).toBe(false);
  });
});

describe("search", () => {
  it("asks only from two letters", () => {
    expect(searchUrl("B")).toBeNull();
    expect(searchUrl(" Bau ")).toBe("/api/safe?q=Bau");
  });

  it("keeps the four public fields and drops the rest", () => {
    const body = { results: [{ name: "Ernesto Bautista", barangay: "Poblacion", staying_at: "Covered court", at: "2026-10-10T05:42:00.000Z", message: "private" }, { name: "" }] };
    const found = parseFound(body);
    expect(found).toHaveLength(1);
    expect(found[0]).not.toHaveProperty("message");
  });

  it("makes initials", () => {
    expect(initials("Ernesto Bautista")).toBe("EB");
    expect(initials("  maria  de la cruz ")).toBe("MC");
    expect(initials("Cher")).toBe("C");
  });
});

describe("saved check-in", () => {
  it("reads back what was saved", () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    saveCheckedIn({ name: "Lourdes Ramos", staying_at: "At home" }, store);
    expect(parseCheckedIn([...data.values()][0])).toEqual({ name: "Lourdes Ramos", staying_at: "At home" });
  });

  it("is null for nothing or junk", () => {
    expect(parseCheckedIn(null)).toBeNull();
    expect(parseCheckedIn("{")).toBeNull();
    expect(parseCheckedIn("{}")).toBeNull();
  });
});
