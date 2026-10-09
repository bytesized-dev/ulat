import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { walk } from "../walk";

// DESIGN.md: the design system is the source of truth for every number a
// screen renders. Sizes, spacing, radii and type all have tokens in
// globals.css, so a component never measures its own. Tailwind's arbitrary
// value syntax, text-[13px] or max-w-[480px], is how that rule gets broken
// quietly, one component at a time, until nothing can be restyled centrally.
//
// This catches the design axes only. Variant selectors like data-[state=open]
// are not design values and are left alone. Neither is the v4 form that
// names a variable, h-(--input), because the variable is the token. An
// inline style attribute is the other way round the rule, so it is caught
// too.

const axes = new Set([
  "text",
  "leading",
  "tracking",
  "font",
  "w",
  "h",
  "size",
  "min-w",
  "min-h",
  "max-w",
  "max-h",
  "basis",
  "p",
  "px",
  "py",
  "pt",
  "pb",
  "pl",
  "pr",
  "m",
  "mx",
  "my",
  "mt",
  "mb",
  "ml",
  "mr",
  "gap",
  "gap-x",
  "gap-y",
  "space-x",
  "space-y",
  "rounded",
  "bg",
  "border",
  "ring",
  "shadow",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
  "inset-x",
  "inset-y",
  "start",
  "end",
  "ps",
  "pe",
  "ms",
  "me",
  "rounded-t",
  "rounded-b",
  "rounded-l",
  "rounded-r",
  "rounded-s",
  "rounded-e",
  "rounded-tl",
  "rounded-tr",
  "rounded-bl",
  "rounded-br",
  "border-t",
  "border-b",
  "border-l",
  "border-r",
  "border-x",
  "border-y",
  "outline",
  "outline-offset",
  "ring-offset",
  "z",
  "grid-cols",
  "grid-rows",
  "translate-x",
  "translate-y",
]);

// The shadcn files in src/components/ui that we keep as generated. The CLI
// regenerates those, so their internals are not ours to hold to this rule.
// Every other file in src/components/ui, restyled or new, is held to it. A
// file leaves this list when it is restyled, never the other way round.
const vendored = new Set(
  [
    "badge",
    "checkbox",
    "dialog",
    "dropdown-menu",
    "label",
    "popover",
    "separator",
    "skeleton",
    "switch",
    "table",
    "tabs",
    "tooltip",
  ].map((name) => `src/components/ui/${name}.tsx`),
);

// The exceptions, each with its reason.
const allowed = new Map([
  ["src/app/global-error.tsx", "renders when the root layout failed, so the stylesheet with the tokens may not be there"],
]);

const arbitrary = /([a-z][a-z-]*)-\[/g;

function offendersIn(file: string): string[] {
  const found: string[] = [];
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (/\bstyle=\{\{/.test(line)) found.push(`${file}:${index + 1}: inline style in ${line.trim()}`);
      for (const match of line.matchAll(arbitrary)) {
        const axis = match[1];
        if (!axes.has(axis)) continue;
        const before = line[match.index - 1];
        // A letter before means this is the tail of a longer word, such as
        // the w in group-has-w, and not a utility of its own.
        if (before && /[a-z]/.test(before)) continue;
        found.push(`${file}:${index + 1}: ${axis}-[...] in ${line.trim()}`);
      }
    });
  return found;
}

describe("no raw design values in components", () => {
  it("uses tokens, not arbitrary Tailwind values, for size, spacing and type", () => {
    const offenders = walk("src")
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => !vendored.has(file))
      .filter((file) => !allowed.has(file))
      .flatMap(offendersIn);

    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist honest, so an exception cannot outlive its file", () => {
    const missing = [...allowed.keys(), ...vendored].filter((file) => !walk("src").includes(file));
    expect(missing).toEqual([]);
  });
});
