#!/usr/bin/env node
// Checks the AI test set in eval/ before it goes to CJ: photo and voice counts, that every file has
// a source row and two labels, which photos the labelers disagree on, and voice rows that pnpm eval
// would skip. The rules match src/lib/eval/run.ts, so a row that passes here is not dropped there.
// Reads files only. Exits 1 when something blocks the eval.
//
// Usage: node scripts/check-eval.mjs

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EVAL = "eval";
const CLASSES = new Set(["total", "partial", "none"]);
// Language codes as in VOICE_LANGUAGES in src/lib/eval/metrics.ts. run.ts matches them exactly, so
// "EN" is a row it drops.
const LANGUAGES = new Set(["tl", "ceb", "mixed", "en"]);
const LANGUAGE_NAMES = { tl: "Tagalog", ceb: "Bisaya", mixed: "Taglish", en: "English" };
// Same values as the Need enum. A row lists several separated by semicolons, or none.
const NEEDS = new Set(["water", "food", "tarp", "medicine", "hygiene_kit", "baby_needs"]);
// Columns run.ts requires in voice.csv.
const VOICE_COLUMNS = ["file", "language", "household_head", "people", "hurt", "missing", "what_happened", "needs"];
const PHOTO_RANGE = [40, 60];
const VOICE_RANGE = [10, 15];

const errors = [];
const warnings = [];

function files(dir) {
  const path = join(EVAL, dir);
  return existsSync(path) ? readdirSync(path).filter((f) => !f.startsWith(".")).map((f) => `${dir}/${f}`) : [];
}

// Minimal CSV reader with quoted fields. Returns objects keyed by the header row. A missing column
// is a problem, as in parseCsv in src/lib/eval/csv.ts, and the file then yields no rows.
function readCsv(name, required) {
  const path = join(EVAL, name);
  if (!existsSync(path)) {
    errors.push(`${name} is missing`);
    return [];
  }
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') cell += text[i++];
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") (row.push(cell), (cell = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  const [header = [], ...body] = rows;
  const keys = header.map((h) => h.trim());
  const absent = header.length ? required.filter((k) => !keys.includes(k)) : [];
  if (absent.length) {
    for (const k of absent) errors.push(`${name} is missing the "${k}" column`);
    return [];
  }
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

// Rows of the markdown table in SOURCES.md, without the header and divider.
function readSources() {
  const path = join(EVAL, "SOURCES.md");
  if (!existsSync(path)) {
    errors.push("SOURCES.md is missing");
    return [];
  }
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("|"))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
    .filter((cells) => cells.length >= 4 && !/^-+$/.test(cells[0].replace(/:/g, "")) && cells[0].toLowerCase() !== "file");
}

function checkRange(kind, count, [min, max]) {
  if (count === 0) errors.push(`no ${kind} yet, need ${min} to ${max}`);
  else if (count < min) errors.push(`${count} ${kind}, need at least ${min}`);
  else if (count > max) warnings.push(`${count} ${kind}, the plan asks for ${min} to ${max}`);
}

function missingFrom(label, expected, actual) {
  const have = new Set(actual);
  const missing = expected.filter((f) => !have.has(f));
  if (missing.length) errors.push(`${missing.length} ${label}: ${missing.join(", ")}`);
}

function duplicates(label, names) {
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) errors.push(`duplicate ${label}: ${[...new Set(dupes)].join(", ")}`);
}

// Photos
const photos = files("photos");
const sources = readSources();
const labels = readCsv("labels.csv", ["file", "label_a", "label_b"]);

checkRange("photos", photos.length, PHOTO_RANGE);
duplicates("rows in labels.csv", labels.map((l) => l.file));
duplicates("rows in SOURCES.md", sources.map((s) => s[0]));
missingFrom("photos with no row in SOURCES.md", photos, sources.map((s) => s[0]));
missingFrom("photos with no row in labels.csv", photos, labels.map((l) => l.file));

for (const [file, url, author, license] of sources) {
  if (!url || !author || !license) errors.push(`SOURCES.md: ${file} needs a source URL, author and license`);
  if (photos.length && !photos.includes(file)) warnings.push(`SOURCES.md lists ${file} but it is not in eval/photos`);
}

let agreed = 0;
const disagreements = [];
for (const { file, label_a, label_b } of labels) {
  if (photos.length && !photos.includes(file)) warnings.push(`labels.csv lists ${file} but it is not in eval/photos`);
  // run.ts reads labels case-insensitively (parseLabel), so "Total" counts there and here.
  const [a, b] = [label_a, label_b].map((v) => v.toLowerCase());
  for (const [who, value, norm] of [["label_a", label_a, a], ["label_b", label_b, b]]) {
    if (!value) errors.push(`labels.csv: ${file} has no ${who}`);
    else if (!CLASSES.has(norm)) errors.push(`labels.csv: ${file} ${who} "${value}" is not total, partial or none`);
  }
  if (CLASSES.has(a) && CLASSES.has(b)) {
    if (a === b) agreed++;
    else disagreements.push(`${file} (${a} vs ${b})`);
  }
}
const labeled = agreed + disagreements.length;

// Voice notes
const voice = files("voice");
const voiceRows = readCsv("voice.csv", VOICE_COLUMNS);

checkRange("voice notes", voice.length, VOICE_RANGE);
duplicates("rows in voice.csv", voiceRows.map((v) => v.file));
missingFrom("voice notes with no row in voice.csv", voice, voiceRows.map((v) => v.file));

const perLanguage = {};
for (const row of voiceRows) {
  if (voice.length && !voice.includes(row.file)) warnings.push(`voice.csv lists ${row.file} but it is not in eval/voice`);
  const lang = row.language;
  if (!LANGUAGES.has(lang)) errors.push(`voice.csv: ${row.file} language "${lang}" is not tl, ceb, mixed or en, in lower case`);
  else perLanguage[lang] = (perLanguage[lang] ?? 0) + 1;
  for (const need of row.needs.split(";").map((n) => n.trim()).filter(Boolean)) {
    if (!NEEDS.has(need)) errors.push(`voice.csv: ${row.file} need "${need}" is not one of ${[...NEEDS].join(", ")}`);
  }
  // run.ts takes a blank household_head, people, hurt or missing as "not stated", so only a bad number fails.
  for (const field of ["people", "hurt", "missing"]) {
    if (row[field] && !/^\d+$/.test(row[field])) errors.push(`voice.csv: ${row.file} ${field} "${row[field]}" is not a whole number`);
  }
}
for (const lang of LANGUAGES) {
  if (voiceRows.length && !perLanguage[lang]) warnings.push(`no voice notes in ${LANGUAGE_NAMES[lang]}`);
}

// Report
const pct = labeled ? Math.round((agreed / labeled) * 100) : 0;
console.log(`Photos      ${photos.length} files, ${sources.length} sources, ${labels.length} label rows`);
console.log(`Agreement   ${agreed} of ${labeled} labeled photos (${pct}%)`);
console.log(`Voice       ${voice.length} files, ${voiceRows.length} rows (${[...LANGUAGES].map((l) => `${LANGUAGE_NAMES[l]} ${perLanguage[l] ?? 0}`).join(", ")})`);
if (disagreements.length) {
  console.log(`\nLabelers disagree on ${disagreements.length}, settle these before the eval:`);
  for (const d of disagreements) console.log(`  ${d}`);
}
if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log(`  ${w}`);
}
if (errors.length) {
  console.log("\nProblems:");
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
console.log("\nThe test set looks complete.");
