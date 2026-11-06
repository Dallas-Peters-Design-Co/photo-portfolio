import { describe, expect, it } from "vitest";
import type { BoardItem, BoardWire } from "../../types";
import {
  boardPasteSpot,
  bundleOf,
  CLIP_TYPE,
  clipFrom,
  holdClip,
  layersForFrame,
  pasteOnBoard,
} from "./itemClipboard";

const item = (
  id: string,
  kind: BoardItem["kind"],
  x: number,
  y: number,
  w = 100,
  h = 100,
  z = 1
) => ({ height: h, id, kind, width: w, x, y, z }) as BoardItem;

const frame = item("f", "frame", 0, 0, 400, 300, 0);
const onFrame = item("t", "text", 50, 50, 100, 100, 2);
const node = item("n", "op", 1000, 0, 200, 200, 3);
const loose = item("x", "note", 3000, 3000);
const items = [frame, onFrame, node, loose];
const wires = [
  { id: "w1", sourceItemId: "t", targetItemId: "n" },
  { id: "w2", sourceItemId: "n", targetItemId: "x" },
] as BoardWire[];

const pasteEvent = (data: Record<string, string>) => {
  const transfer = new DataTransfer();
  for (const [type, value] of Object.entries(data)) {
    transfer.setData(type, value);
  }
  return new ClipboardEvent("paste", { clipboardData: transfer });
};

describe("copying board items", () => {
  it("takes a frame with what's on it, and only the wires between what's taken", () => {
    const bundle = bundleOf([frame, node], items, wires);
    expect(bundle.items.map((i) => i.id)).toEqual(["f", "t", "n"]);
    expect(bundle.wires.map((w) => w.id)).toEqual(["w1"]);
    expect(bundle.label).toBe("3 items copied from a board");
  });

  it("pastes fresh copies with their wires rewired, on top of the board", () => {
    const bundle = bundleOf([frame, node], items, wires);
    const pasted = pasteOnBoard(bundle, [loose], { x: 0, y: 0 });
    const ids = pasted.items.map((i) => i.id);
    expect(ids).not.toContain("f");
    expect(new Set(ids).size).toBe(3);
    const [wire] = pasted.wires;
    expect(ids).toContain(wire?.sourceItemId);
    expect(ids).toContain(wire?.targetItemId);
    expect(Math.min(...pasted.items.map((i) => i.z))).toBeGreaterThan(loose.z);
  });

  it("steps a paste on from the originals while they're on the board", () => {
    const bundle = bundleOf([onFrame], items, wires);
    expect(boardPasteSpot(bundle, items, { x: 0, y: 0 }, 1)).toEqual({
      x: 90,
      y: 90,
    });
    expect(boardPasteSpot(bundle, items, { x: 0, y: 0 }, 2)).toEqual({
      x: 130,
      y: 130,
    });
  });

  it("centres a paste on the view on a board without the originals", () => {
    const bundle = bundleOf([onFrame], items, wires);
    expect(boardPasteSpot(bundle, [], { x: 500, y: 500 }, 1)).toEqual({
      x: 450,
      y: 450,
    });
  });
});

describe("the clipboard", () => {
  it("reads a bundle back from its custom format, as another tab would", () => {
    const bundle = bundleOf([onFrame], items, wires);
    const read = clipFrom(
      pasteEvent({ [CLIP_TYPE]: JSON.stringify(bundle), "text/plain": "x" })
    );
    expect(read?.items.map((i) => i.id)).toEqual(["t"]);
  });

  it("uses the held copy only while the clipboard still has its label", () => {
    const bundle = bundleOf([onFrame], items, wires);
    holdClip(bundle);
    expect(clipFrom(pasteEvent({ "text/plain": bundle.label }))).toBe(bundle);
    expect(clipFrom(pasteEvent({ "text/plain": "something else" }))).toBeNull();
  });
});

describe("pasting into a frame", () => {
  const other = { height: 300, width: 400, x: 2000, y: 1000 };

  it("puts layers in the same place in another frame", () => {
    const bundle = bundleOf([onFrame], items, [], frame);
    const { layers, nudge } = layersForFrame(bundle, other);
    expect(layers.map((l) => [l.x, l.y])).toEqual([[2050, 1050]]);
    expect(nudge).toBe(false);
  });

  it("steps them on when pasted back into their own frame", () => {
    const bundle = bundleOf([onFrame], items, [], frame);
    expect(layersForFrame(bundle, frame).nudge).toBe(true);
  });

  it("centres items off the board, leaving out what a frame can't hold", () => {
    const bundle = bundleOf([loose, node], items, []);
    const { layers } = layersForFrame(bundle, other);
    expect(layers.map((l) => l.id)).toEqual(["x"]);
    expect(layers.map((l) => [l.x, l.y])).toEqual([[2150, 1100]]);
  });
});
