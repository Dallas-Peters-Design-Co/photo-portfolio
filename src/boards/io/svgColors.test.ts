import { describe, expect, it } from "vitest";
import { normalizeColour, recolourSvg, svgColoursOf } from "./svgColors";
import { onSvgEdit, saveSvgEdit } from "./svgEditEvents";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
  <style>.a { fill: #f00; stroke: rgb(0, 0, 255) }</style>
  <defs><linearGradient id="g"><stop stop-color="red"/><stop offset="1" stop-color="#00FF00"/></linearGradient></defs>
  <rect class="a" width="10" height="10"/>
  <circle fill="url(#g)" stroke="none" r="3"/>
  <path d="M0 0" style="fill:#ff0000;stroke:currentColor"/>
  <path d="M1 1" fill='#0000ff80'/>
</svg>`;

describe("svgColoursOf", () => {
  it("finds each colour once, however it's spelled, most used first", () => {
    expect(svgColoursOf(SVG)).toEqual([
      { count: 3, hex: "#ff0000" },
      { count: 1, hex: "#0000ff" },
      { count: 1, hex: "#00ff00" },
      { count: 1, hex: "#0000ff80" },
    ]);
  });

  it("leaves references and keywords alone", () => {
    for (const value of [
      "none",
      "url(#g)",
      "currentColor",
      "inherit",
      "nope",
    ]) {
      expect(normalizeColour(value)).toBeNull();
    }
    expect(normalizeColour("#F00")).toBe("#ff0000");
  });
});

describe("recolourSvg", () => {
  it("changes every spelling of a colour and nothing else", () => {
    const out = recolourSvg(SVG, new Map([["#ff0000", "#123456"]]));
    expect(svgColoursOf(out).map((c) => c.hex)).toEqual([
      "#123456",
      "#0000ff",
      "#00ff00",
      "#0000ff80",
    ]);
    expect(out).toContain('fill="url(#g)"');
    expect(out).toContain("stroke:currentColor");
    expect(out).toContain('id="g"');
    // Still an SVG the browser can read.
    const doc = new DOMParser().parseFromString(out, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
  });
});

describe("saving an edit", () => {
  it("reaches the board editor, and says so when nobody is listening", async () => {
    await expect(saveSvgEdit("a", "<svg/>")).rejects.toThrow(
      "can't be changed"
    );
    const got: string[] = [];
    const off = onSvgEdit((id, svg) => {
      got.push(`${id}:${svg}`);
      return Promise.resolve();
    });
    await saveSvgEdit("a", "<svg/>");
    expect(got).toEqual(["a:<svg/>"]);
    off();
  });
});
