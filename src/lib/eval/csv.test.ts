import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads quoted fields with commas, doubled quotes and line breaks", () => {
    const text = 'file,label_a,label_b,notes\r\nphoto04.jpg,partial,,"judgment call: roof gone, one wall down"\r\nphoto05.jpg,total,total,"said ""gutted""\nin one line"\r\n';
    expect(parseCsv(text, ["file", "notes"])).toEqual([
      { file: "photo04.jpg", label_a: "partial", label_b: "", notes: "judgment call: roof gone, one wall down" },
      { file: "photo05.jpg", label_a: "total", label_b: "total", notes: 'said "gutted"\nin one line' },
    ]);
  });

  it("skips blank lines, a byte order mark and a missing last newline", () => {
    expect(parseCsv("﻿a,b\n\n1,2\n\n3,4")).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("fills short rows with empty strings and returns nothing for an empty file", () => {
    expect(parseCsv("a,b,c\n1,2")).toEqual([{ a: "1", b: "2", c: "" }]);
    expect(parseCsv("")).toEqual([]);
  });

  it("fails loudly on a missing column or an unclosed quote", () => {
    expect(() => parseCsv("a,b\n1,2", ["a", "label_b"])).toThrow('missing the "label_b" column');
    expect(() => parseCsv('a,b\n"1,2')).toThrow("unclosed quote");
  });
});
