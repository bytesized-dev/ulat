import { describe, expect, it } from "vitest";
import { isLowBattery } from "./battery";

describe("isLowBattery", () => {
  it("warns at 19% on battery", () => {
    expect(isLowBattery({ battery_percent: 19, charging: false })).toBe(true);
  });

  it("does not warn at 20%", () => {
    expect(isLowBattery({ battery_percent: 20, charging: false })).toBe(false);
  });

  it("warns at 0%", () => {
    expect(isLowBattery({ battery_percent: 0, charging: false })).toBe(true);
  });

  it("does not warn when the battery is unknown", () => {
    expect(isLowBattery({ battery_percent: null, charging: false })).toBe(false);
    expect(isLowBattery({ battery_percent: null, charging: null })).toBe(false);
  });

  it("does not warn while charging", () => {
    expect(isLowBattery({ battery_percent: 5, charging: true })).toBe(false);
  });

  it("warns when charging is unknown", () => {
    expect(isLowBattery({ battery_percent: 18, charging: null })).toBe(true);
  });

  it("does not warn without a status", () => {
    expect(isLowBattery(null)).toBe(false);
    expect(isLowBattery(undefined)).toBe(false);
  });
});
