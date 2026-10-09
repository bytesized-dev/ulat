// Cuts one town's barangays out of the HDX Philippines boundaries (COD-AB,
// CC BY-IGO) and writes them as GeoJSON with { name, pcode }. The HDX zip is
// about 900 MB, so this reads only the admin level 4 files out of it with
// HTTP range requests, about 190 MB, and never unpacks the rest.
//
//   node scripts/map/hdx-barangays.mjs <adm3 pcode> <out.geojson>
//
// The adm3 pcode is the town's code in HDX, for example PH0907201 for Dapitan
// City. Outlines are simplified to about 5 m. Prints the bbox of the result.

import { mkdtempSync, openSync, readSync, rmSync, writeFileSync, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInflateRaw } from "node:zlib";

const zipUrl =
  "https://data.humdata.org/dataset/caf116df-f984-4deb-85ca-41b349d3f313/resource/4e4067d6-3fc8-4d2c-91ea-330c3d4f8e8e/download/phl_admin_boundaries.shp.zip";
const tolerance = 0.00005; // degrees, about 5 m

const [pcode, output] = process.argv.slice(2);
if (!pcode || !output) {
  console.error("Usage: node scripts/map/hdx-barangays.mjs <adm3 pcode> <out.geojson>");
  process.exit(1);
}

/* ---------- remote zip ---------- */

// HDX redirects to a signed link per request, so every read goes through zipUrl.
const range = (from, to) => fetch(zipUrl, { headers: { Range: `bytes=${from}-${to}` } });

async function zipEntries() {
  const probe = await range(0, 0);
  const length = Number(probe.headers.get("content-range").split("/")[1]);
  const tail = Buffer.from(await (await range(length - 65557, length - 1)).arrayBuffer());
  const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let size = tail.readUInt32LE(end + 12);
  let offset = tail.readUInt32LE(end + 16);
  const end64 = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06]));
  if (offset === 0xffffffff && end64 >= 0) {
    size = Number(tail.readBigUInt64LE(end64 + 40));
    offset = Number(tail.readBigUInt64LE(end64 + 48));
  }
  const dir = Buffer.from(await (await range(offset, offset + size - 1)).arrayBuffer());
  const entries = new Map();
  for (let p = 0; p < dir.length && dir.readUInt32LE(p) === 0x02014b50; ) {
    const nameLength = dir.readUInt16LE(p + 28);
    const name = dir.toString("utf8", p + 46, p + 46 + nameLength);
    entries.set(name, { method: dir.readUInt16LE(p + 10), size: dir.readUInt32LE(p + 20), offset: dir.readUInt32LE(p + 42) });
    p += 46 + nameLength + dir.readUInt16LE(p + 30) + dir.readUInt16LE(p + 32);
  }
  return entries;
}

async function extract(entry, path) {
  const local = Buffer.from(await (await range(entry.offset, entry.offset + 29)).arrayBuffer());
  const start = entry.offset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
  const body = Readable.fromWeb((await range(start, start + entry.size - 1)).body);
  if (entry.method !== 8) throw new Error("Expected a deflated entry");
  await pipeline(body, createInflateRaw(), createWriteStream(path));
}

/* ---------- shapefile ---------- */

function readDbf(path, keep) {
  const fd = openSync(path, "r");
  const head = Buffer.alloc(32);
  readSync(fd, head, 0, 32, 0);
  const count = head.readUInt32LE(4);
  const headLength = head.readUInt16LE(8);
  const recordLength = head.readUInt16LE(10);
  const fieldHead = Buffer.alloc(headLength);
  readSync(fd, fieldHead, 0, headLength, 0);
  const fields = [];
  for (let p = 32, at = 1; fieldHead[p] !== 0x0d; p += 32) {
    const name = fieldHead.toString("latin1", p, p + 11).replace(/\0.*$/, "");
    fields.push({ name, at, length: fieldHead[p + 16] });
    at += fieldHead[p + 16];
  }
  const rows = [];
  const record = Buffer.alloc(recordLength);
  for (let i = 0; i < count; i++) {
    readSync(fd, record, 0, recordLength, headLength + i * recordLength);
    const row = { index: i };
    for (const f of fields) if (keep.includes(f.name)) row[f.name] = record.toString("utf8", f.at, f.at + f.length).trim();
    rows.push(row);
  }
  return rows;
}

function readPolygon(shp, shx, index) {
  const pointer = Buffer.alloc(8);
  readSync(shx, pointer, 0, 8, 100 + index * 8);
  const offset = pointer.readUInt32BE(0) * 2;
  const length = pointer.readUInt32BE(4) * 2;
  const record = Buffer.alloc(length);
  readSync(shp, record, 0, length, offset + 8);
  const parts = record.readInt32LE(36);
  const points = record.readInt32LE(40);
  const starts = Array.from({ length: parts }, (_, k) => record.readInt32LE(44 + k * 4));
  const base = 44 + parts * 4;
  return starts.map((start, k) => {
    const stop = k + 1 < parts ? starts[k + 1] : points;
    const ring = [];
    for (let j = start; j < stop; j++) ring.push([record.readDoubleLE(base + j * 16), record.readDoubleLE(base + j * 16 + 8)]);
    return ring;
  });
}

/* ---------- geometry ---------- */

function simplifyLine(points) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1e-12;
    let max = 0;
    let far = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / length;
      if (d > max) [max, far] = [d, i];
    }
    if (max > tolerance) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// A closed ring starts and ends on one point, so split it at its farthest point first.
function simplifyRing(ring) {
  let far = 1;
  for (let i = 1, max = 0; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > max) [max, far] = [d, i];
  }
  const out = simplifyLine(ring.slice(0, far + 1)).concat(simplifyLine(ring.slice(far)).slice(1));
  return out.length >= 4 ? out : ring;
}

const signedArea = (ring) =>
  ring.reduce((sum, [x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length];
    return sum + x1 * y2 - x2 * y1;
  }, 0) / 2;

const round = (n) => Math.round(n * 1e6) / 1e6;

// Shapefile outer rings run clockwise and holes counter clockwise. GeoJSON wants the reverse.
function toGeometry(rings) {
  const polygons = [];
  for (const ring of rings.map(simplifyRing)) {
    const flipped = ring.map(([x, y]) => [round(x), round(y)]).reverse();
    if (signedArea(ring) < 0 || polygons.length === 0) polygons.push([flipped]);
    else polygons.at(-1).push(flipped);
  }
  return polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons };
}

/* ---------- run ---------- */

const work = mkdtempSync(join(tmpdir(), "ulat-hdx-"));
try {
  const entries = await zipEntries();
  for (const ext of ["dbf", "shx", "shp"]) {
    const name = `phl_admin4.${ext}`;
    if (!entries.has(name)) throw new Error(`${name} is not in the HDX zip. The release may have renamed it.`);
    console.log(`Reading ${name}, ${(entries.get(name).size / 1e6).toFixed(0)} MB`);
    await extract(entries.get(name), join(work, name));
  }

  const rows = readDbf(join(work, "phl_admin4.dbf"), ["adm4_name", "adm4_pcode", "adm3_name", "adm3_pcode"]).filter(
    (row) => row.adm3_pcode === pcode,
  );
  if (rows.length === 0) throw new Error(`No barangays with adm3_pcode ${pcode}`);

  const shp = openSync(join(work, "phl_admin4.shp"), "r");
  const shx = openSync(join(work, "phl_admin4.shx"), "r");
  const features = rows.map((row) => ({
    type: "Feature",
    properties: { name: row.adm4_name, pcode: row.adm4_pcode },
    geometry: toGeometry(readPolygon(shp, shx, row.index)),
  }));

  let [west, south, east, north] = [180, 90, -180, -90];
  JSON.stringify(features.map((f) => f.geometry.coordinates), (_, v) => {
    if (Array.isArray(v) && typeof v[0] === "number") {
      [west, south, east, north] = [Math.min(west, v[0]), Math.min(south, v[1]), Math.max(east, v[0]), Math.max(north, v[1])];
    }
    return v;
  });

  writeFileSync(output, JSON.stringify({ type: "FeatureCollection", features }));
  console.log(`${rows[0].adm3_name}: ${features.length} barangays`);
  console.log(`bbox: ${[west, south, east, north].map((n) => n.toFixed(5)).join(",")}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
