import { describe, expect, it } from "vitest";
import { AD_SIZES, sizeTitle } from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import {
  copyFrameAtSizes,
  duplicateFrame,
  resetFrameScale,
  resizeFrame,
  scaleResetOf,
} from "./adFrames";

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

  it("keeps going right past the canvas edge, and past a neighbour", () => {
    const far = { ...frame, x: 11_000 };
    const next = item({
      height: 540,
      id: "n",
      kind: "frame",
      width: 540,
      x: 11_000 + 540 + 120,
      y: 1000,
      z: 0,
    });
    const out = copyFrameAtSizes([far, next], "f", [square]);
    expect(out?.added[0]).toMatchObject({ x: next.x + 540 + 120, y: 1000 });
  });
});

describe("duplicateFrame", () => {
  it("copies the frame and its design beside it, as they are", () => {
    const out = duplicateFrame(board, "f");
    const copy = out?.added.find((i) => i.kind === "frame");
    expect(copy).toMatchObject({ body: frame.body, height: 540, width: 540 });
    expect(copy?.id).not.toBe("f");
    // Clear of the original, so it isn't read as part of it.
    expect((copy?.x ?? 0) >= frame.x + frame.width).toBe(true);
    const words = out?.added.find((i) => i.kind === "text");
    expect(words?.fontSize).toBe(48);
    expect((words?.x ?? 0) - (copy?.x ?? 0)).toBe(headline.x - frame.x);
    expect((words?.y ?? 0) - (copy?.y ?? 0)).toBe(headline.y - frame.y);
    // The original's contents and the loose item aren't touched or copied.
    expect(out?.added).toHaveLength(3);
  });

  it("keeps poster-sized type when copying a frame at another size", () => {
    const big = { ...headline, fontSize: 1400 };
    const out = copyFrameAtSizes([frame, photo, big], "f", [square]);
    expect(out?.added.find((i) => i.kind === "text")?.fontSize).toBe(1400);
  });
});

describe("duplicateFrame next to other frames", () => {
  it("goes past a neighbour instead of landing on it, even off the canvas", () => {
    const poster = (id: string, x: number) =>
      item({ height: 5400, id, kind: "frame", width: 3600, x, y: 0, z: 0 });
    const a = poster("a", 0);
    const b = poster("b", 3700);
    const c = poster("c", 7400);
    const words = item({ id: "w", kind: "text", x: 200, y: 200 });
    const out = duplicateFrame([a, b, c, words], "a");
    const copy = out?.added.find((i) => i.kind === "frame");
    expect(copy?.x).toBeGreaterThanOrEqual(c.x + c.width);
    expect(copy?.y).toBe(0);
  });
});

describe("resetting a frame's scale", () => {
  // A 1080 square drawn at 810 units, 1.5x the standard 540.
  const big = item({ ...frame, height: 810, width: 810 });
  const words = item({
    config: { radius: 12 },
    fontSize: 72,
    height: 150,
    id: "w",
    kind: "text",
    width: 300,
    x: 1150,
    y: 1300,
  });

  it("knows a frame drawn at another scale, and one that isn't", () => {
    expect(scaleResetOf(big)).toBeCloseTo(540 / 810);
    expect(scaleResetOf(frame)).toBeNull();
  });

  it("scales the frame and its contents together about its corner", () => {
    const out = resetFrameScale([big, words], "f");
    const f = out?.find((i) => i.id === "f");
    const w = out?.find((i) => i.id === "w");
    expect(f).toMatchObject({ height: 540, width: 540, x: 1000, y: 1000 });
    expect(w).toMatchObject({
      fontSize: 48,
      height: 100,
      width: 200,
      x: 1100,
      y: 1200,
    });
    expect(w?.config).toEqual({ radius: 8 });
  });
});

describe("copyFrameAtSizes keeps the stacking", () => {
  it("stacks each copy's layers front to back as the original's, whatever order the board lists them in", () => {
    // The board's list isn't the stacking order: a background sent to the
    // back keeps its place in the list and only its z changes.
    const text = item({
      fontSize: 48,
      height: 100,
      id: "t",
      kind: "text",
      width: 400,
      x: 1100,
      y: 1100,
      z: 9,
    });
    const background = item({
      height: 540,
      id: "bg",
      width: 540,
      x: 1000,
      y: 1000,
      z: 2,
    });
    const logo = item({
      height: 60,
      id: "logo",
      width: 120,
      x: 1020,
      y: 1020,
      z: 5,
    });
    const out = copyFrameAtSizes([frame, text, logo, background], "f", [
      size("ig-story"),
    ]);
    const copies = (out?.added ?? []).filter((i) => i.kind !== "frame");
    const z = (match: (i: BoardItem) => boolean) => copies.find(match)?.z ?? -1;
    const bg = z((i) => i.width >= 540 && i.kind === "photo");
    const lg = z((i) => i.kind === "photo" && i.width < 540);
    const tx = z((i) => i.kind === "text");
    expect(bg).toBeLessThan(lg);
    expect(lg).toBeLessThan(tx);
  });
});
