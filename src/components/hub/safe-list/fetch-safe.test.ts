import { describe, expect, it } from "vitest";
import { fetchSafe } from "./fetch-safe";

const row = { name: "Ernesto Bautista", barangay: "Sinonoc", staying_at: "Covered court", at: "2026-10-10T05:42:00.000Z" };
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe("fetchSafe", () => {
  it("returns the rows of a valid reply", async () => {
    expect(await fetchSafe("Bautista", reply(200, { results: [row] }))).toEqual([row]);
  });

  it("asks for the trimmed, encoded name", async () => {
    let url = "";
    const spy = (async (input: RequestInfo | URL) => {
      url = String(input);
      return new Response(JSON.stringify({ results: [] }));
    }) as typeof fetch;
    await fetchSafe("  dela Cruz ", spy);
    expect(url).toBe("/api/safe?q=dela%20Cruz");
  });

  it("does not ask the hub for a name that is too short", async () => {
    const never = (async () => {
      throw new Error("should not be called");
    }) as typeof fetch;
    expect(await fetchSafe("B", never)).toBeNull();
    expect(await fetchSafe("  ", never)).toBeNull();
  });

  it("returns null for a bad reply, an error status or an unreachable hub", async () => {
    expect(await fetchSafe("Bautista", reply(200, { results: [{ name: 1 }] }))).toBeNull();
    expect(await fetchSafe("Bautista", reply(500, {}))).toBeNull();
    const down = (async () => {
      throw new TypeError("network");
    }) as typeof fetch;
    expect(await fetchSafe("Bautista", down)).toBeNull();
  });
});
