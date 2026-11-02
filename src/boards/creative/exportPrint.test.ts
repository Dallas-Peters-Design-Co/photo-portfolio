import { describe, expect, it } from "vitest";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { bleedBox } from "./exportPng";
import { printSpecFor } from "./exportPrint";
import { cropMarksSvg, printHtml } from "./printHtml";

const frame = {
  ...BLANK_ITEM,
  body: "Print · Poster · 18×24 · 5400×7200",
  height: 240,
  id: "f",
  kind: "frame",
  width: 180,
  x: 0,
  y: 0,
} as BoardItem;

const rect = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string
) =>
  ({
    ...BLANK_ITEM,
    config: {
      fill,
      opacity: 1,
      radius: 0,
      stroke: "#00000000",
      strokeWidth: 0,
      tool: "rect",
    },
    height: h,
    id,
    kind: "drawing",
    width: w,
    x,
    y,
    z: 1,
  }) as BoardItem;

describe("print export", () => {
  it("reads the trim from the frame's print size, with the right bleed", () => {
    expect(printSpecFor(frame)).toEqual({
      bleedIn: 0.125,
      heightIn: 24,
      widthIn: 18,
    });
    const a2 = { ...frame, body: "Print · Poster · A2 · 4961×7016" };
    expect(printSpecFor(a2).bleedIn).toBeCloseTo(3 / 25.4, 5);
  });

  it("grows layers touching the edge into the bleed, and only those", () => {
    const edge = rect("e", 0, 0, 180, 120, "#ff0000");
    expect(bleedBox(edge, frame, 2)).toEqual({
      height: 122,
      width: 184,
      x: -2,
      y: -2,
    });
    const inside = rect("i", 20, 20, 50, 50, "#00ff00");
    expect(bleedBox(inside, frame, 2)).toEqual({
      height: 50,
      width: 50,
      x: 20,
      y: 20,
    });
  });

  it("lays the sheet out at paper size, with the bleed and the marks", async () => {
    const letter = {
      ...frame,
      body: "Print · Flyer · Letter · 2550×3300",
      height: 110,
      width: 85,
    };
    const words = {
      ...BLANK_ITEM,
      body: "Build Slow",
      height: 20,
      id: "t",
      kind: "text",
      width: 85,
      x: 0,
      y: 0,
      z: 2,
    } as BoardItem;
    const html = await printHtml(
      letter,
      [rect("bg", 0, 0, 85, 110, "#123456"), words],
      () => null,
      { bleedIn: 0.125, heightIn: 11, marksIn: 0.25, widthIn: 8.5 }
    );
    // 8.5 × 11 in, plus ⅛ in bleed and ¼ in marks on each side.
    expect(html).toContain("@page{size:9.25in 11.75in;margin:0}");
    // 96 px to the inch: the background runs 12 px past each trim edge.
    expect(html).toContain("left:-12px");
    expect(html).toContain("width:840px");
    expect(html).toContain("height:1080px");
    expect(html).toContain('stroke="#000"');
  });

  it("draws crop marks only when there is a margin for them", () => {
    const marks = cropMarksSvg({
      bleedIn: 0.125,
      heightIn: 11,
      marksIn: 0.25,
      widthIn: 8.5,
    });
    // Trim's left edge: ¼ in margin + ⅛ in bleed = 36 px; the mark stops at the margin.
    expect(marks).toContain("M36 0V24");
    expect(marks).toContain("M0 36H24");
    expect(
      cropMarksSvg({ bleedIn: 0.125, heightIn: 1, marksIn: 0, widthIn: 1 })
    ).toBe("");
  });
});
