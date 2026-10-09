// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { PosterSheet } from "../../components/hub/print/poster-sheet";
import { freshDb } from "./test-setup";

type Fresh = Awaited<ReturnType<typeof freshDb>>;
let db: Fresh["db"];
let schema: Fresh["schema"];
let lib: typeof import("./print");

const THREE_PM = "2026-10-10T07:00:00.000Z";

function setSetting(key: string, value: string) {
  db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } }).run();
}

beforeAll(async () => {
  ({ db, schema } = await freshDb("print"));
  lib = await import("./print");
  setSetting("town", "Dapitan City");
  setSetting("wifi_name", "ULAT-HUB");
  setSetting("hub_address", "https://hub.dapitan.example");
  const sitreps = await import("./sitreps");
  sitreps.createSitrep(db, new Date(THREE_PM));
});

describe("getPrintReport", () => {
  it("loads a saved report by its number, with the snapshot and the town", () => {
    const report = lib.getPrintReport(db, "1");
    expect(report?.sitrep.number).toBe(1);
    expect(report?.sitrep.snapshot.houses_checked).toBe(0);
    expect(report?.town).toBe("Dapitan City");
  });

  it("returns null for a number with no report, which the page answers with a 404", () => {
    expect(lib.getPrintReport(db, "2")).toBeNull();
    expect(lib.getPrintReport(db, "999")).toBeNull();
  });

  it("returns null for a number that is not a plain positive integer", () => {
    for (const n of ["0", "-1", "1.5", "abc", "", "01", "1e3", " 1"]) expect(lib.getPrintReport(db, n)).toBeNull();
  });
});

describe("readPoster", () => {
  it("reads the hub address, the Wi-Fi name and the town from settings", () => {
    const poster = lib.readPoster(db);
    expect(poster).toMatchObject({
      town: "Dapitan City",
      wifiName: "ULAT-HUB",
      hubAddress: "https://hub.dapitan.example",
      hubHost: "hub.dapitan.example",
      wifiPassword: null,
    });
  });

  it("has no address, and no QR code, when the setting is missing", () => {
    db.delete(schema.settings).where(eqKey("hub_address")).run();
    const poster = lib.readPoster(db);
    expect(poster.hubAddress).toBeNull();
    expect(renderToStaticMarkup(createElement(PosterSheet, { poster }))).not.toContain('role="img"');
    setSetting("hub_address", "https://hub.dapitan.example");
  });
});

describe("addressHost", () => {
  it("drops the scheme and trailing slashes", () => {
    expect(lib.addressHost("https://hub.example.ph/")).toBe("hub.example.ph");
    expect(lib.addressHost("http://192.168.1.10:3000")).toBe("192.168.1.10:3000");
    expect(lib.addressHost("https://hub.[your-domain]")).toBe("hub.[your-domain]");
  });
});

describe("the poster QR code", () => {
  const html = (address: string) => {
    const poster = { ...lib.readPoster(db), hubAddress: address, hubHost: lib.addressHost(address) };
    return renderToStaticMarkup(createElement(PosterSheet, { poster }));
  };

  it("draws the code for the hub_address setting", () => {
    setSetting("hub_address", "https://hub.dapitan.example");
    const poster = lib.readPoster(db);
    const markup = renderToStaticMarkup(createElement(PosterSheet, { poster }));
    expect(markup).toContain(`d="${lib.qrPath("https://hub.dapitan.example").d}"`);
    expect(markup).toContain("Or open hub.dapitan.example");
  });

  it("changes when the address changes", () => {
    expect(html("https://hub.one.example")).not.toBe(html("https://hub.two.example"));
    expect(lib.qrPath("https://hub.one.example").d).not.toBe(lib.qrPath("https://hub.two.example").d);
  });

  it("is a square grid of ink cells with no remote reference", () => {
    const { size, d } = lib.qrPath("https://hub.dapitan.example");
    expect(size).toBeGreaterThan(20);
    expect(d.startsWith("M")).toBe(true);
    expect(html("https://hub.dapitan.example")).not.toMatch(/https?:\/\/(?!hub\.)/);
  });
});

describe("hazardSentence", () => {
  it("ends each line with one full stop", () => {
    expect(lib.hazardSentence(["Landslide on road", "Fallen power line, Purok 3."])).toBe("Landslide on road. Fallen power line, Purok 3.");
  });
});

function eqKey(key: string) {
  return eq(schema.settings.key, key);
}
