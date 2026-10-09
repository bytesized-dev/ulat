import { describe, expect, it } from "vitest";
import { dayKey, formatTime, formatTimeWithZone, zoneLabel } from "@/lib/time";

// The helpers every screen uses instead of Date arithmetic. Manila is
// UTC+8 with no daylight saving, which makes the expectations exact.

describe("time helpers", () => {
  const instant = "2026-09-05T23:30:00Z";

  it("renders an instant in the organisation's zone", () => {
    expect(formatTime(instant, "Asia/Manila")).toBe("7:30 AM");
    expect(formatTimeWithZone(instant, "Asia/Manila")).toBe("7:30 AM PHT");
  });

  it("groups by the local day, not the UTC day", () => {
    expect(dayKey(instant, "Asia/Manila")).toBe("2026-09-06");
    expect(dayKey(instant, "UTC")).toBe("2026-09-05");
  });

  it("falls back to the zone name when it has no short label", () => {
    expect(zoneLabel("Europe/Amsterdam")).toBe("Europe/Amsterdam");
  });
});
