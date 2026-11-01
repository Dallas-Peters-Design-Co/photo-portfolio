import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import {
  duplicate,
  layersOf,
  newShape,
  newText,
  reorder,
} from "./creativeModel";
import { snapEdge, snapMove } from "./snap";

const item = (over: Partial<BoardItem> & { id: string }): BoardItem =>
  ({
    body: null,
    config: null,
    fontSize: null,
    height: 100,
    kind: "reference",
    width: 100,
    x: 0,
    y: 0,
    z: 1,
    ...over,
  }) as BoardItem;

const frame = item({
  height: 540,
  id: "f",
  kind: "frame",
  width: 540,
  x: 1000,
  y: 1000,
  z: 0,
});

describe("layers", () => {
  it("are the frame's own items, back to front", () => {
    const board = [
      frame,
      item({ id: "top", x: 1100, y: 1100, z: 9 }),
      item({ id: "bottom", x: 1100, y: 1100, z: 2 }),
      item({ id: "away", x: 5000, y: 5000, z: 1 }),
      item({ id: "node", kind: "op", x: 1100, y: 1100 }),
    ];
    expect(layersOf(frame, board).map((i) => i.id)).toEqual(["bottom", "top"]);
  });

  it("reorders within the frame's band of z", () => {
    const layers = [
      item({ id: "a", z: 4 }),
      item({ id: "b", z: 5 }),
      item({ id: "c", z: 6 }),
    ];
    expect([...reorder(layers, "a", "front")]).toEqual([
      ["b", 4],
      ["c", 5],
      ["a", 6],
    ]);
    expect(reorder(layers, "c", "backward").get("c")).toBe(5);
  });
});

describe("new layers", () => {
  it("places text and shapes centred, on top, sized to the frame", () => {
    const board = [frame, item({ id: "x", x: 1100, y: 1100, z: 7 })];
    const text = newText(frame, board);
    expect(text.z).toBe(8);
    expect(text.x + text.width / 2).toBeCloseTo(1270, 0);
    expect(text.fontSize).toBe(49);
    const shape = newShape(frame, board, "rounded", "#ff0000");
    expect(shape.config).toMatchObject({ fill: "#ff0000", tool: "rounded" });
    expect(shape.width).toBe(216);
  });

  it("duplicates with a new id, nudged, on top", () => {
    const a = item({ id: "a", x: 1100, y: 1100, z: 3 });
    const copy = duplicate(a, [a]);
    expect(copy.id).not.toBe("a");
    expect(copy.x).toBeGreaterThan(1100);
    expect(copy.z).toBe(4);
  });
});

describe("snapping", () => {
  const box = { height: 100, width: 100, x: 1217, y: 1003 };

  it("pulls a box to the frame centre and edge within the threshold", () => {
    const { box: snapped, guides } = snapMove(box, frame, [], 6);
    expect(snapped.x + 50).toBe(1270);
    expect(snapped.y).toBe(1000);
    expect(guides).toEqual({ x: [1270], y: [1000] });
  });

  it("leaves a box alone when nothing is close", () => {
    const far = { ...box, x: 1150, y: 1150 };
    expect(snapMove(far, frame, [], 6).box).toEqual(far);
  });

  it("snaps a single edge to another layer", () => {
    const other = { height: 50, width: 50, x: 1300, y: 1300 };
    expect(snapEdge(1297, "x", frame, [other], 6)).toEqual({
      line: 1300,
      value: 1300,
    });
  });
});
