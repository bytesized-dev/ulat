import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const skip = new Set(["node_modules", ".next", ".git", "drizzle", "playwright-report", "test-results", "public", "coverage", ".vercel"]);

/** Every file under dir, skipping build output and dependencies. */
export function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}
