import { describe, expect, it } from "vitest";
import { mapTokens } from "@/lib/hub/map-assets";
import { swatchClass } from "./map-palette";

describe("swatchClass", () => {
  it("reads every map role from its design token", () => {
    for (const [role, token] of Object.entries(mapTokens)) {
      expect(swatchClass[role as keyof typeof mapTokens]).toBe(`bg-${token}`);
    }
  });
});
