import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { walk } from "../walk";

// DESIGN.md: never use a hex value in a component. Tokens live in
// globals.css and the two browser chrome colours live in src/config.ts.
// Everything rendered reads a token.
//
// The %23 branch matters. A hex inside a data URI is written url encoded, so
// a select chevron carried a hardcoded grey past this test for a whole
// version. An svg background cannot read currentColor, so the fix is a real
// icon element with a token class, not a cleverer string.

const hex = /(?:#|%23)(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;

describe("no raw colours in components", () => {
  it("uses tokens, not hex values, in every tsx file under src", () => {
    const offenders = walk("src")
      .filter((file) => file.endsWith(".tsx"))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, index) => (hex.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : [])),
      );
    expect(offenders).toEqual([]);
  });
});
