import { describe, expect, it } from "vitest";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { cropMarks } from "../io/printPdf";
import { bleedBox, renderCreative } from "./exportPng";
import { dpiLadder, exportPrintPdf, printSpecFor } from "./exportPrint";

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

  it("prints at 300 dpi where it fits, and steps down for big posters", () => {
    expect(
      dpiLadder({ bleedIn: 0.125, heightIn: 11, widthIn: 8.5 }, true)[0]
    ).toBe(300);
    const big = dpiLadder({ bleedIn: 0.125, heightIn: 36, widthIn: 24 }, true);
    expect(big[0]).toBeLessThan(300);
    expect(big[0]).toBeGreaterThanOrEqual(200);
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

  it("fills the bleed with the background and leaves the words inside", async () => {
    const png = await renderCreative(
      frame,
      [rect("bg", 0, 0, 180, 240, "#ff0000")],
      180,
      () => null,
      "#ffffff",
      10
    );
    const bitmap = await createImageBitmap(png);
    expect([bitmap.width, bitmap.height]).toEqual([200, 260]);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.drawImage(bitmap, 0, 0);
    // The very corner of the bleed is the background colour, not paper.
    expect([...ctx.getImageData(1, 1, 1, 1).data]).toEqual([255, 0, 0, 255]);
  });

  it("writes a PDF with trim and bleed boxes and crop marks in the margin", async () => {
    const letter = {
      ...frame,
      body: "Print · Flyer · Letter · 2550×3300",
      height: 110,
      width: 85,
    };
    const { blob, dpi } = await exportPrintPdf(
      letter,
      [rect("bg", 0, 0, 85, 110, "#123456")],
      () => null,
      { bleed: true, marks: true }
    );
    expect(dpi).toBe(300);
    const head = new TextDecoder("latin1").decode(
      new Uint8Array(await blob.arrayBuffer()).slice(0, 2000)
    );
    // 8.5 × 11 in + ⅛ in bleed + ¼ in marks on each side, in points.
    expect(head).toContain("/MediaBox [0 0 666.000 846.000]");
    expect(head).toContain("/BleedBox [18.000 18.000 648.000 828.000]");
    expect(head).toContain("/TrimBox [27.000 27.000 639.000 819.000]");
    expect(
      cropMarks({
        bleedIn: 0.125,
        heightIn: 11.25,
        marksIn: 0.25,
        widthIn: 8.75,
      })
    ).toContain(" S Q");
    expect(cropMarks({ bleedIn: 0.125, heightIn: 1, widthIn: 1 })).toBe("");
  });
});
