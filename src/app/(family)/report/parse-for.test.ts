import { describe, expect, it } from "vitest";
import { parseFor } from "./parse-for";

describe("parseFor", () => {
  it("reads for=neighbor", () => {
    expect(parseFor("neighbor")).toBe("neighbor");
  });

  it("asks for nothing when the link has no value", () => {
    expect(parseFor(undefined)).toBeNull();
  });

  it("asks for nothing for an unknown or repeated value", () => {
    expect(parseFor("family")).toBeNull();
    expect(parseFor("desk")).toBeNull();
    expect(parseFor("")).toBeNull();
    expect(parseFor(["neighbor", "neighbor"])).toBeNull();
  });
});
