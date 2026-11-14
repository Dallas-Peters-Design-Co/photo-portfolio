import { describe, expect, it } from "vitest";
import { cleanSvg } from "./siteLogo.js";
import { stylesheetsOf } from "./sitePage.js";

const RUNS_OR_LINKS = /script|onload|onclick|javascript|evil|foreignObject/i;

describe("a scanned SVG logo, cleaned before it's kept", () => {
  it("drops anything that runs and links off the file", () => {
    const svg = cleanSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="x()"><script>alert(1)</script><a href="javascript:alert(1)"><rect fill="#2a84f8" onclick="y()"/></a><use href="#mark"/><image href="https://evil.example/x.png"/><foreignObject><div/></foreignObject></svg>`
    );
    expect(svg).not.toBeNull();
    expect(svg).not.toMatch(RUNS_OR_LINKS);
    expect(svg).toContain('href="#mark"');
    expect(svg).toContain('fill="#2a84f8"');
  });

  it("refuses something that isn't an SVG", () => {
    expect(cleanSvg("<html><body>hi</body></html>")).toBeNull();
  });
});

describe("a page's stylesheets", () => {
  it("are found as absolute addresses, against the page's base", () => {
    const html = `<head><base href="/site/"><link rel="stylesheet" href="a.css"><link href='https://cdn.example/b.css' rel='preload stylesheet'><link rel="icon" href="x.ico"></head>`;
    expect(stylesheetsOf(html, "https://example.com/page")).toEqual([
      "https://example.com/site/a.css",
      "https://cdn.example/b.css",
    ]);
  });
});
