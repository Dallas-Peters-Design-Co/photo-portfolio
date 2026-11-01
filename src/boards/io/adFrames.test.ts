import { describe, expect, it } from "vitest";
import { AD_SIZES, sizeTitle } from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import { copyFrameAtSizes, resizeFrame } from "./adFrames";

const item = (patch: Partial<BoardItem>): BoardItem =>
  ({
    fontSize: null,
    height: 100,
    id: "a",
    kind: "photo",
    width: 100,
    x: 0,
    y: 0,
    z: 1,
    ...patch,
  }) as BoardItem;

const size = (id: string) => {
  const found = AD_SIZES.find((s) => s.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
};

const square = size("ig-square");
const frame = item({
  body: sizeTitle(square),
  height: 540,
  id: "f",
  kind: "frame",
  width: 540,
  x: 1000,
  y: 1000,
  z: 0,
});
const photo = item({ height: 540, id: "p", width: 540, x: 1000, y: 1000 });
const headline = item({
  fontSize: 48,
  height: 80,
  id: "h",
  kind: "text",
  width: 300,
  x: 1120,
  y: 1230,
  z: 2,
});
const outside = item({ id: "o", x: 5000, y: 5000 });
const board = [frame, photo, headline, outside];

describe("resizeFrame", () => {
  it("resizes the frame, renames it and lays out only its contents", () => {
    const next = resizeFrame(board, "f", size("ig-story"));
    const byId = new Map(next?.map((i) => [i.id, i]));
    expect(byId.get("f")).toMatchObject({
      body: "Instagram · Story / Reel · 1080×1920",
      height: 960,
      width: 540,
      x: 1000,
    });
    expect(byId.get("p")).toMatchObject({ height: 960, width: 540 });
    expect(byId.get("o")).toEqual(outside);
  });

  it("ignores something that is not a frame", () => {
    expect(resizeFrame(board, "p", square)).toBeNull();
  });
});

describe("copyFrameAtSizes", () => {
  it("adds a frame plus its contents per size, to the right, with new ids", () => {
    const out = copyFrameAtSizes(board, "f", [
      size("ig-story"),
      size("fb-link"),
    ]);
    expect(out?.frameIds).toHaveLength(2);
    expect(out?.added).toHaveLength(6);
    const frames = out?.added.filter((i) => i.kind === "frame") ?? [];
    expect(frames[0]?.x).toBe(1000 + 540 + 120);
    expect(frames[1]?.x).toBe(1660 + 540 + 120);
    expect(frames[1]).toMatchObject({ height: 315, width: 600 });
    const ids = new Set(out?.added.map((i) => i.id));
    expect(ids.has("p") || ids.has("h") || ids.has("f")).toBe(false);
    const text = out?.added.find((i) => i.kind === "text");
    expect(text?.fontSize).toBe(48);
  });

  it("wraps under the frame when a row would leave the canvas", () => {
    const far = { ...frame, x: 11_000 };
    const out = copyFrameAtSizes([far], "f", [square]);
    expect(out?.added[0]).toMatchObject({ x: 11_000, y: 1000 + 540 + 120 });
  });
});
