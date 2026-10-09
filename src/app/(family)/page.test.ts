import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const town = vi.hoisted(() => ({ value: "Dapitan City" as string | undefined }));
vi.mock("@/lib/auth/settings", () => ({ readSetting: (key: string) => (key === "town" ? town.value : undefined) }));

function hrefs(html: string) {
  return [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
}

describe("family home", () => {
  const html = renderToStaticMarkup(createElement(HomePage));

  it("shows the town until the phone finds its barangay, and the report button", () => {
    expect(html).toMatch(/<h1[^>]*>Dapitan City<\/h1>/);
    expect(html).toContain("You&#x27;re at");
    expect(html).toContain("Report my household");
  });

  it("falls back to the evacuation center when the hub has no town", () => {
    town.value = undefined;
    expect(renderToStaticMarkup(createElement(HomePage))).toMatch(/<h1[^>]*>the evacuation center<\/h1>/);
    town.value = "Dapitan City";
  });

  it("links every row to its route", () => {
    expect(hrefs(html)).toEqual(["/report?for=family", "/report?for=neighbor", "/status", "/map", "/safe"]);
  });
});
