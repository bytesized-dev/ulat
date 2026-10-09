import { describe, expect, it } from "vitest";
import { buildSms, smsSegments } from "./sms";

const canvas = {
  simulation: true,
  town: "[Town]",
  number: 3,
  timeLabel: "3PM",
  housesChecked: 46,
  totally: 14,
  partially: 23,
  families: 58,
  people: 241,
  hurt: 6,
  missing: 1,
  priority: ["Sinonoc", "Dawo (Pob.)", "Potol (Pob.)"],
  needs: { water: 41, food: 38, tarp: 33 },
  notYetVisited: 17,
};

describe("buildSms", () => {
  it("includes every key number and fits in two texts", () => {
    const text = buildSms(canvas);
    for (const n of ["46", "14", "23", "58", "241", "6 hurt", "1 missing", "17"]) expect(text).toContain(n);
    expect(text).toContain("Priority: Sinonoc, Dawo (Pob.).");
    expect(smsSegments(text)).toBe(2);
  });
});

describe("smsSegments", () => {
  it("counts GSM and non GSM texts", () => {
    expect(smsSegments("a".repeat(160))).toBe(1);
    expect(smsSegments("a".repeat(161))).toBe(2);
    expect(smsSegments("a".repeat(306))).toBe(2);
    expect(smsSegments("ñ".repeat(10))).toBe(1);
    expect(smsSegments("€".repeat(80))).toBe(1);
    expect(smsSegments("€".repeat(81))).toBe(2);
    expect(smsSegments("ą".repeat(70))).toBe(1);
    expect(smsSegments("ą".repeat(71))).toBe(2);
  });
});
