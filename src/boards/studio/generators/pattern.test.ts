import { describe, expect, it } from "vitest";
import { patternTool } from "./pattern";

/** Pattern Studio: vector out, every kind a valid SVG, ids that can't clash. */

const ctx = {
  height: 400,
  image: null,
  palette: ["#111111", "#f4f1ea"],
  width: 600,
};
const defaults = Object.fromEntries(
  patternTool.params.map((p) => [p.key, "default" in p ? p.default : 0])
);

const parse = (svg: string) =>
  new DOMParser().parseFromString(svg, "image/svg+xml");

describe("Pattern Studio", () => {
  it("goes onto the board and into frames as an SVG, not a PNG", () => {
    expect(patternTool.vector).toBe(true);
  });

  it("makes a well-formed SVG for every kind of pattern", () => {
    const kinds = patternTool.params.find((p) => p.key === "kind");
    const values = kinds && "options" in kinds ? kinds.options : [];
    expect(values.length).toBeGreaterThan(0);
    for (const { value } of values ?? []) {
      const doc = parse(
        patternTool.render({ ...defaults, kind: value }, ctx as never)
      );
      expect(doc.querySelector("parsererror")).toBeNull();
      expect(doc.documentElement.getAttribute("width")).toBe("600");
    }
  });

  it("names its tile for what it draws, so two patterns on one page don't share a tile", () => {
    const a = patternTool.render(
      { ...defaults, kind: "dots", spacing: 24 },
      ctx as never
    );
    const b = patternTool.render(
      { ...defaults, kind: "lines", spacing: 40 },
      ctx as never
    );
    const idOf = (svg: string) => parse(svg).querySelector("pattern")?.id;
    expect(idOf(a)).toBeTruthy();
    expect(idOf(a)).not.toBe(idOf(b));
    expect(a).toContain(`url(#${idOf(a)})`);
  });
});
