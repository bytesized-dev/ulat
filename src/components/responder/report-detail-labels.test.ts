import { describe, expect, it } from "vitest";
import { concernText, needLabel } from "./report-detail-labels";

describe("concernText", () => {
  it("names hurt and missing, never only a colour", () => {
    expect(concernText(1, 0)).toBe("1 hurt");
    expect(concernText(2, 1)).toBe("2 hurt, 1 missing");
    expect(concernText(0, 3)).toBe("3 missing");
  });
  it("is null when nobody is hurt or missing", () => {
    expect(concernText(0, 0)).toBeNull();
  });
});

describe("needLabel", () => {
  it("uses sentence case for every need", () => {
    expect(needLabel("hygiene_kit")).toBe("Hygiene kit");
    expect(needLabel("water")).toBe("Water");
  });
});
