import { describe, expect, it } from "vitest";
import { whereOptions } from "./where-options";

describe("whereOptions", () => {
  it("lists the shelters first, then the two fixed places", () => {
    expect(whereOptions(["Poblacion covered court", "Poblacion Elementary School"])).toEqual([
      "Poblacion covered court",
      "Poblacion Elementary School",
      "With relatives",
      "At home",
    ]);
  });

  it("still gives the two fixed places when the hub has no shelters", () => {
    expect(whereOptions([])).toEqual(["With relatives", "At home"]);
  });

  it("lists a repeated name once and drops blank names", () => {
    expect(whereOptions(["At home", "Chapel", "Chapel", "  "])).toEqual(["At home", "Chapel", "With relatives"]);
  });
});
