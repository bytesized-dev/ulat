/**
 * Parses a CSV file into records keyed by the header row. Handles quoted
 * fields with commas, doubled quotes and line breaks inside quotes, CRLF line
 * ends and a leading byte order mark. A quote opens a quoted field only at the
 * start of a field, so a quote inside an unquoted field is plain text. Blank lines are skipped. Throws if a
 * required column is missing, so a renamed header fails loudly.
 */
export function parseCsv(text: string, required: readonly string[] = []): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  // A quote opens a quoted field only before the field has any character.
  let fieldStarted = false;
  const body = text.replace(/^﻿/, "");

  const endField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      endRow();
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (quoted) throw new Error("CSV has an unclosed quote");
  if (field !== "" || row.length > 0) endRow();

  const [header, ...data] = rows;
  if (!header) return [];
  const names = header.map((name) => name.trim());
  for (const name of required) {
    if (!names.includes(name)) throw new Error(`CSV is missing the "${name}" column`);
  }
  return data.map((cells) => Object.fromEntries(names.map((name, i) => [name, (cells[i] ?? "").trim()])));
}
