#!/usr/bin/env node
// Prints a design/screens HTML file as an indented outline of elements, classes and copy.
// Drops the CSS block, inline styles, SVG paths and canvas links. Components never copy
// those, and they are most of each file. Look at the PNG in design/png for the layout.
//
// Usage: node scripts/screen-outline.mjs design/screens/family/home.html [more files]

import { readFileSync } from "node:fs";

const KEEP = [
  "id", "role", "type", "name", "for", "placeholder", "alt", "value", "title",
  "checked", "disabled", "readonly", "required", "inputmode", "autocomplete",
  "aria-label", "aria-current", "aria-pressed", "aria-selected", "aria-checked",
  "aria-expanded", "aria-live", "aria-hidden",
];
const VOID = new Set(["area", "br", "col", "hr", "img", "input", "link", "meta", "source", "wbr"]);
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", times: "×", rarr: "→", larr: "←" };

const decode = (s) =>
  s.replace(/&(#x?[\da-f]+|\w+);/gi, (m, e) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : (ENTITIES[e] ?? m),
  );

function parseAttrs(src) {
  const attrs = {};
  for (const [, k, , v1, v2, v3] of src.matchAll(/([\w:-]+)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[k.toLowerCase()] = v1 ?? v2 ?? v3 ?? "";
  }
  return attrs;
}

function parse(html) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>|<(svg)\b([^>]*)>[\s\S]*?<\/svg>|<\/([\w-]+)\s*>|<([\w-]+)([^>]*?)(\/?)>|([^<]+)/gi;
  for (const m of html.matchAll(re)) {
    const top = stack[stack.length - 1];
    if (m[2]) {
      top.children.push({ tag: "svg", attrs: parseAttrs(m[3]), children: [] });
    } else if (m[4]) {
      const tag = m[4].toLowerCase();
      const i = stack.findLastIndex((n) => n.tag === tag);
      if (i > 0) stack.length = i;
    } else if (m[5]) {
      const node = { tag: m[5].toLowerCase(), attrs: parseAttrs(m[6]), children: [] };
      top.children.push(node);
      if (!m[7] && !VOID.has(node.tag)) stack.push(node);
    } else if (m[8]) {
      const text = decode(m[8]).replace(/\s+/g, " ").trim();
      if (text) top.children.push({ text });
    }
  }
  return root;
}

function label(node) {
  const cls = (node.attrs.class ?? "").split(/\s+/).filter(Boolean).map((c) => "." + c).join("");
  const attrs = KEEP.filter((k) => k in node.attrs).map((k) => (node.attrs[k] === "" ? k : `${k}="${node.attrs[k]}"`));
  return [node.tag + cls, ...attrs].join(" ");
}

function render(node, depth) {
  if (node.text !== undefined) return [`${"  ".repeat(depth)}"${node.text}"`];
  const kids = node.children;
  if (kids.length === 1 && kids[0].text !== undefined) {
    return [`${"  ".repeat(depth)}${label(node)} "${kids[0].text}"`];
  }
  return [`${"  ".repeat(depth)}${label(node)}`, ...renderChildren(kids, depth + 1)];
}

function renderChildren(kids, depth) {
  const out = [];
  let prev = null;
  let count = 0;
  const flush = () => {
    if (!prev) return;
    if (count > 1) prev[0] += ` ×${count}`;
    out.push(...prev);
  };
  for (const kid of kids) {
    const lines = render(kid, depth);
    if (prev && count > 0 && lines.join("\n") === prev.join("\n").replace(/ ×\d+$/, "")) {
      count++;
      continue;
    }
    flush();
    prev = lines;
    count = 1;
  }
  flush();
  return out;
}

function outline(file) {
  const html = readFileSync(file, "utf8");
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() ?? file;
  const note = html.match(/<!--\s*(Reference only[\s\S]*?)-->/)?.[1].match(/Route[^.]*/)?.[0] ?? "";
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return [`# ${title}${note ? ` (${note})` : ""}`, ...renderChildren(parse(body).children, 0)].join("\n");
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/screen-outline.mjs <design/screens/...html> [more files]");
  process.exit(1);
}
console.log(files.map(outline).join("\n\n"));
