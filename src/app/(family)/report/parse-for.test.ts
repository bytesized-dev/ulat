import { describe, expect, it } from "vitest";
import { parseFor } from "./parse-for";

describe("parseFor", () => {
  it("reads for=neighbor", () => {
    expect(parseFor("neighbor")).toBe("neighbor");
  });

  it("reads for=family", () => {
    expect(parseFor("family")).toBe("family");
  });

  it("asks for nothing when the link has no value", () => {
    expect(parseFor(undefined)).toBeNull();
  });

  it("asks for nothing for an unknown or repeated value", () => {
    expect(parseFor("desk")).toBeNull();
    expect(parseFor("")).toBeNull();
    expect(parseFor(["neighbor", "neighbor"])).toBeNull();
    expect(parseFor(["family"])).toBeNull();
  });
});
