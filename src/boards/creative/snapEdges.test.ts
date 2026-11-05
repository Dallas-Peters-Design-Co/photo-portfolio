import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import type { Box } from "./creativeModel";
import { type ResizeDrag, resizeStep } from "./resize";
import type { Handle } from "./SelectionBox";
import { snapMove } from "./snap";
import { insetsOf, pictureInsets } from "./visibleEdges";

/**
 * Smart guides line up what's drawn (a picture's see-through margins and a
 * text box's spare room left out), and a resize snaps whichever sides move.
 */
const frame: Box = { height: 1000, width: 1000, x: 0, y: 0 };
const other: Box = { height: 100, width: 200, x: 600, y: 400 };
const corner: Box = { height: 100, width: 100, x: 100, y: 100 };
const origin: Box = { height: 100, width: 200, x: 300, y: 310 };

const drag = (handle: Handle): ResizeDrag => ({
  handle,
  id: "a",
  kind: "resize",
  origin,
  originFont: null,
  startX: 0,
  startY: 0,
});
const step = (
  handle: Handle,
  dx: number,
  dy: number,
  kind: BoardItem["kind"] = "drawing",
  inset: { b: number; l: number; r: number; t: number } | null = null
) =>
  resizeStep(drag(handle), { kind } as BoardItem, {
    alt: false,
    dx,
    dy,
    frame,
    inset,
    others: [other, corner],
    shift: false,
    threshold: 6,
  });

describe("resizing snaps every moving side", () => {
  it("snaps the left side, keeping the right where it was", () => {
    // Left edge from 300 to 203: onto the corner box's right edge at 200.
    const { box, guides } = step("w", -97, 0);
    expect(box.x).toBe(200);
    expect(box.x + box.width).toBe(500);
    expect(guides.x).toEqual([200]);
  });

  it("snaps the top side, keeping the bottom where it was", () => {
    const { box, guides } = step("n", 0, -107);
    expect(box.y).toBe(200);
    expect(box.y + box.height).toBe(410);
    expect(guides.y).toEqual([200]);
  });

  it("snaps a picture's corner too, keeping its shape", () => {
    // Right edge dragged to 597: snaps to 600 and the height follows.
    const { box, guides } = step("se", 97, 40, "reference");
    expect(box.x + box.width).toBe(600);
    expect(box.width / box.height).toBeCloseTo(2);
    expect(guides.x).toEqual([600]);
  });

  it("lines up what's drawn when the box has margins", () => {
    // 10 units of see-through on the right, growing with the box: the drawn
    // edge (not the box's) meets the other's left at 600.
    const { box, guides } = step("e", 114, 0, "drawing", {
      b: 0,
      l: 0,
      r: 10,
      t: 0,
    });
    const drawnRight = box.x + box.width - (10 * box.width) / 200;
    expect(guides.x).toEqual([600]);
    expect(drawnRight).toBeCloseTo(600, 0);
  });
});

describe("moving lines up what's drawn", () => {
  it("snaps the drawn edge, not the box", () => {
    const box = { height: 100, width: 100, x: 512, y: 50 };
    const { box: landed } = snapMove(box, frame, [other], 6, {
      b: 0,
      l: 0,
      r: 15,
      t: 0,
    });
    // Drawn right edge (box right − 15) on the other's left at 600.
    expect(landed.x + landed.width - 15).toBe(600);
  });
});

describe("a picture's drawn area", () => {
  it("leaves out see-through margins, scaled into the box", () => {
    // A 1000×500 picture, opaque in its middle half across, filling a 200×100 box.
    const ins = pictureInsets(
      { height: 100, width: 200 },
      { b: 1, h: 500, l: 0.25, r: 0.75, t: 0, w: 1000 },
      "cover",
      { x: 0.5, y: 0.5 }
    );
    expect(ins).toEqual({ b: 0, l: 50, r: 50, t: 0 });
  });

  it("counts the bars round a contained picture", () => {
    const ins = pictureInsets(
      { height: 200, width: 200 },
      { b: 1, h: 100, l: 0, r: 1, t: 0, w: 200 },
      "contain",
      { x: 0.5, y: 0.5 }
    );
    expect(ins).toEqual({ b: 50, l: 0, r: 0, t: 50 });
  });
});

describe("a text box's drawn area", () => {
  it("runs from the letters' edges, cap height to baseline", () => {
    const el = document.createElement("div");
    el.style.cssText =
      "position:absolute;left:0;top:0;width:400px;height:200px;font:700 40px/1.6 sans-serif;text-align:center";
    el.textContent = "HELLO";
    document.body.append(el);
    const ins = insetsOf({ kind: "text" } as BoardItem, el, 1);
    el.remove();
    // Centred: spare room on both sides, about the same.
    expect(ins?.l).toBeGreaterThan(50);
    expect(Math.abs((ins?.l ?? 0) - (ins?.r ?? 0))).toBeLessThan(4);
    // Above the caps (half the leading and the ascent over cap height), and
    // everything under the baseline.
    expect(ins?.t).toBeGreaterThan(10);
    expect(ins?.b).toBeGreaterThan(200 - 64);
  });
});
