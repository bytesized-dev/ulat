import { describe, expect, it } from "vitest";
import { lockUrl, safeNext } from "./lock";

describe("safeNext", () => {
  it("keeps a hub path and its query", () => {
    expect(safeNext("/hub/map")).toBe("/hub/map");
    expect(safeNext("/hub/entries?barangay=Mabini")).toBe("/hub/entries?barangay=Mabini");
  });

  it("falls back to the overview", () => {
    for (const bad of [
      undefined,
      null,
      "",
      "hub/map",
      "/",
      "/r/queue",
      "/hubs",
      "/hub/lock",
      "/hub/lock/",
      "//evil.example/hub",
      "/\\evil.example",
      "https://evil.example/hub",
      "javascript:alert(1)",
    ]) {
      expect(safeNext(bad)).toBe("/hub");
    }
  });

  it("reads the first value of a repeated parameter", () => {
    expect(safeNext(["/hub/map", "/r"])).toBe("/hub/map");
    expect(safeNext(["/r", "/hub/map"])).toBe("/hub");
  });

  it("removes dot segments", () => {
    expect(safeNext("/hub/../r/queue")).toBe("/hub");
  });
});

describe("lockUrl", () => {
  it("returns to the page the user was on", () => {
    expect(lockUrl("/hub/map?x=1")).toBe("/hub/lock?next=%2Fhub%2Fmap%3Fx%3D1");
  });

  it("leaves the parameter out for the overview", () => {
    expect(lockUrl("/hub")).toBe("/hub/lock");
  });
});
