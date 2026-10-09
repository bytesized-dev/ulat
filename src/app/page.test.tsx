import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

function hrefs(html: string) {
  return [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
}

describe("family home", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("shows the center name and the report button", () => {
    expect(html).toMatch(/<h1[^>]*>Poblacion evacuation center<\/h1>/);
    expect(html).toContain("You&#x27;re at");
    expect(html).toContain("Report my household");
  });

  it("links every row to its route", () => {
    expect(hrefs(html)).toEqual(["/report", "/report?for=neighbor", "/status", "/map", "/safe"]);
  });
});
