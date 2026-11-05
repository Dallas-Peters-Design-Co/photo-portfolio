import { expect, it, vi } from "vitest";
import type { BoardItem } from "../../types";

/**
 * A selection offered to the Studio is drawn cropped to its own edges, so a
 * mosaic made from it fills the space; with nothing selected, the frame.
 */
const drawn: { height: number; width: number; x: number; y: number }[] = [];
vi.mock("./exportPng", () => ({
  renderCreative: (box: {
    height: number;
    width: number;
    x: number;
    y: number;
  }) => {
    drawn.push(box);
    return Promise.resolve(new Blob());
  },
}));
const { frameStudioProps } = await import("./frameStudio");

const item = (id: string, x: number, y: number, w: number, h: number) =>
  ({ height: h, id, kind: "text", width: w, x, y, z: 1 }) as BoardItem;
const frame = { ...item("f", 0, 0, 1000, 1500), kind: "frame" } as BoardItem;
const layers = [item("a", 100, 200, 300, 400), item("b", 500, 900, 200, 100)];

const propsWith = (selected: string[]) =>
  frameStudioProps({
    add: () => undefined,
    applyType: () => undefined,
    editId: null,
    frame,
    items: [frame, ...layers],
    layers,
    name: "F",
    selected,
    size: { h: 1500, w: 1000 },
    studio: "mosaic",
    swap: () => undefined,
    textElementFor: () => null,
  });

it("draws a selection cropped to its edges, and the frame without one", async () => {
  await propsWith(["a", "b"])?.frame.snapshot?.();
  expect(drawn.at(-1)).toEqual({ height: 800, width: 600, x: 100, y: 200 });
  await propsWith([])?.frame.snapshot?.();
  expect(drawn.at(-1)).toMatchObject({ height: 1500, width: 1000, x: 0, y: 0 });
});

it("draws a selection in place: the whole frame, only the selection on it", async () => {
  await propsWith(["a"])?.frame.snapshotInPlace?.();
  expect(drawn.at(-1)).toMatchObject({ height: 1500, width: 1000, x: 0, y: 0 });
  // Nothing selected: nothing to take in place.
  expect(propsWith([])?.frame.snapshotInPlace).toBeUndefined();
});
