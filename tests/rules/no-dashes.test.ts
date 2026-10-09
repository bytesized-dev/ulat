import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { withoutManagedBlock } from "../docs";
import { walk } from "../walk";

// AGENTS.md: no em dashes, no en dashes, anywhere that ships. Docs, skills,
// copy, comments and commit messages. This covers everything in the repo.
// Commit messages are covered by the PR template checklist.

// Built from code points so this file does not trip its own rule.
const dash = new RegExp("[\\u2013\\u2014]");
const extensions = [".md", ".ts", ".tsx", ".mjs", ".css", ".json", ".yml", ".yaml"];

// A hyphen with a space on each side is a dash standing in, which AGENTS.md
// rule 7 names as well. Prose only, because code subtracts.
const standIn = / \S+ - \S+/;

describe("no dashes as punctuation", () => {
  it("has no hyphen standing in for a dash in any markdown file", () => {
    const offenders = walk(".")
      .filter((file) => file.endsWith(".md"))
      .flatMap((file) =>
        withoutManagedBlock(readFileSync(file, "utf8"))
          .split("\n")
          .flatMap((line, index) => (standIn.test(` ${line}`) ? [`${file}:${index + 1}: ${line.trim().slice(0, 80)}`] : [])),
      );
    expect(offenders).toEqual([]);
  });

  it("has no en or em dash in any source or doc file", () => {
    const offenders = walk(".")
      .filter((file) => extensions.some((extension) => file.endsWith(extension)) && !file.endsWith("pnpm-lock.yaml"))
      .flatMap((file) =>
        withoutManagedBlock(readFileSync(file, "utf8"))
          .split("\n")
          .flatMap((line, index) => (dash.test(line) ? [`${file}:${index + 1}: ${line.trim().slice(0, 80)}`] : [])),
      );
    expect(offenders).toEqual([]);
  });
});
