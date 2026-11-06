import { describe, expect, it } from "vitest";
import type { BoardItem, BoardWire } from "../../types";
import { copyOfFrames, frameSummary, landingOn } from "./copyToBoard";

const item = (
  id: string,
  kind: BoardItem["kind"],
  x: number,
  y: number,
  w = 100,
  h = 100
) => ({ height: h, id, kind, width: w, x, y }) as BoardItem;

const a = item("a", "frame", 0, 0, 400, 300);
const b = item("b", "frame", 1000, 0, 400, 300);
const inA = item("ta", "text", 50, 50);
const inB = item("tb", "text", 1050, 50);
const loose = item("x", "note", 3000, 3000);
const items = [a, b, inA, inB, loose];
const wires = [
  { id: "w1", sourceItemId: "ta", targetItemId: "tb" },
  { id: "w2", sourceItemId: "ta", targetItemId: "x" },
] as BoardWire[];

describe("copying frames to another board", () => {
  it("copies every frame given, with what's on them, under new ids", () => {
    const copy = copyOfFrames([a, b], items, wires, { x: 500, y: 600 });
    expect(copy.items).toHaveLength(4);
    expect(copy.items.map((i) => i.id)).not.toContain("a");
    // The arrangement is kept; the group's corner lands where it's asked to.
    const xs = copy.items.map((i) => i.x).sort((p, q) => p - q);
    expect(xs).toEqual([500, 550, 1500, 1550]);
    expect(Math.min(...copy.items.map((i) => i.y))).toBe(600);
    // The wire between the two frames comes too; the one leaving them doesn't.
    expect(copy.wires).toHaveLength(1);
    expect(copy.severed).toBe(1);
  });

  it("counts what a copy of several frames takes", () => {
    expect(frameSummary([a, b], items, wires)).toEqual({
      count: 4,
      severed: 1,
    });
  });

  it("lands copies to the right of a board's own things", () => {
    expect(landingOn([])).toEqual({ x: 200, y: 200 });
    expect(landingOn([item("p", "note", 100, -50, 300, 10)])).toEqual({
      x: 800,
      y: -50,
    });
  });
});
