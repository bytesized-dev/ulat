/** Rows of the Features table in docs/progress.md, as id and status. */
export function featureRows(source: string): { id: string; status: string }[] {
  const table = source.split(/^## Features$/m)[1]?.split(/^## /m)[0] ?? "";
  return table
    .split("\n")
    .filter((line) => /^\| F\d+ /.test(line))
    .map((line) => {
      const cells = line.split("|").map((cell) => cell.trim());
      return { id: cells[1], status: cells[3] };
    });
}

// next dev appends a block to AGENTS.md when it sees a coding agent, and
// rewrites it on every run. It is Next's prose, not ours, so the rules that
// read docs skip the region between its markers.
const managedStart = "<!-- BEGIN:nextjs-agent-rules -->";
const managedEnd = "<!-- END:nextjs-agent-rules -->";

/** The source with Next's managed block blanked, keeping the line count so line numbers stay right. */
export function withoutManagedBlock(source: string): string {
  const start = source.indexOf(managedStart);
  const end = source.indexOf(managedEnd);
  if (start < 0 || end < 0) return source;
  const blank = source.slice(start, end + managedEnd.length).replace(/[^\n]/g, "");
  return source.slice(0, start) + blank + source.slice(end + managedEnd.length);
}
