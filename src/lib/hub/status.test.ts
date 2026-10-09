import { describe, expect, it } from "vitest";
import { fetchHubStatus, formatBattery, readHubStatus } from "./status";

const valid = {
  internet: false,
  phones: 4,
  battery_percent: 80,
  charging: true,
  model_loaded: true,
  storage_free_gb: 120,
  simulation: false,
};

const reply = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe("fetchHubStatus", () => {
  it("returns a valid reply", async () => {
    expect(await fetchHubStatus(reply(200, valid))).toEqual(valid);
  });

  it("returns null when the reply breaks the contract", async () => {
    expect(await fetchHubStatus(reply(200, { phones: "many" }))).toBeNull();
  });

  it("returns null on a server error", async () => {
    expect(await fetchHubStatus(reply(500, {}))).toBeNull();
  });

  it("returns null when the hub can't be reached", async () => {
    const down = (async () => {
      throw new TypeError("network");
    }) as typeof fetch;
    expect(await fetchHubStatus(down)).toBeNull();
  });

  it("returns null when the staff session is missing", async () => {
    expect(await fetchHubStatus(reply(401, { error: "unauthorized" }))).toBeNull();
  });
});

describe("formatBattery", () => {
  it("shows a percent", () => expect(formatBattery(68)).toBe("68%"));
  it("shows Unknown without a reading", () => {
    expect(formatBattery(null)).toBe("Unknown");
    expect(formatBattery(undefined)).toBe("Unknown");
  });
});

describe("readHubStatus", () => {
  it("says the session is gone on a 401", async () => {
    expect(await readHubStatus(reply(401, { error: "unauthorized" }))).toEqual({ status: null, unauthorized: true });
  });

  it("does not call a server error or a lost connection unauthorized", async () => {
    expect(await readHubStatus(reply(500, {}))).toEqual({ status: null, unauthorized: false });
    const down = (async () => {
      throw new TypeError("network");
    }) as typeof fetch;
    expect(await readHubStatus(down)).toEqual({ status: null, unauthorized: false });
  });

  it("returns a valid reply", async () => {
    expect(await readHubStatus(reply(200, valid))).toEqual({ status: valid, unauthorized: false });
  });
});
