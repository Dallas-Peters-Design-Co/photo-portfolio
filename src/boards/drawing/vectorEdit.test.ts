import { expect, it } from "vitest";
import type { BoardItem } from "../../types";
import {
  fitVectorBox,
  groupVectors,
  pathBounds,
  ungroupVector,
} from "./vectorEdit";

// Two letters in a 200×100 box: an "o" (outer square, hole) at 20..60, and
// an "l" bar at 100..110, drawn into a layer twice that size.
const D =
  "M20 20L60 20L60 60L20 60ZM30 30L50 30L50 50L30 50ZM100 10L110 10L110 60L100 60Z";
const shape = {
  config: {
    d: D,
    fill: "#000",
    tool: "vector",
    viewHeight: 100,
    viewWidth: 200,
  },
  height: 200,
  id: "v1",
  kind: "drawing",
  width: 400,
  x: 1000,
  y: 500,
} as unknown as BoardItem;

it("measures a path, curves included", () => {
  expect(pathBounds(D)).toEqual({ maxX: 110, maxY: 60, minX: 20, minY: 10 });
  expect(pathBounds("M0 0Q50 100 100 0")?.maxY).toBeCloseTo(50, 0);
});

it("fits the box to the letters, which stay where they were", () => {
  const fit = fitVectorBox(shape);
  expect({ h: fit.height, w: fit.width, x: fit.x, y: fit.y }).toEqual({
    h: 100,
    w: 180,
    x: 1040,
    y: 520,
  });
  const config = fit.config as { d: string; viewWidth: number };
  expect(config.viewWidth).toBe(90);
  expect(config.d.startsWith("M0 10L40 10")).toBe(true);
});

it("ungroups into letters, each keeping its hole", () => {
  const parts = ungroupVector(shape);
  expect(parts).toHaveLength(2);
  const [o, l] = parts;
  expect(o?.id).toBe("v1");
  expect(l?.id).not.toBe("v1");
  const holes = (o?.config as { d?: string } | undefined)?.d?.split("M");
  expect(holes?.filter(Boolean)).toHaveLength(2);
  expect({ w: o?.width, x: o?.x, y: o?.y }).toEqual({ w: 80, x: 1040, y: 540 });
  expect({ w: l?.width, x: l?.x, y: l?.y }).toEqual({ w: 20, x: 1200, y: 520 });
});

it("groups shapes back into one layer, letters where they were", () => {
  const parts = ungroupVector(shape);
  const one = groupVectors(parts);
  expect(one).not.toBeNull();
  expect({ h: one?.height, w: one?.width, x: one?.x, y: one?.y }).toEqual({
    h: 100,
    w: 180,
    x: 1040,
    y: 520,
  });
  // Drawn at its own box, the shapes sit where the ungrouped parts were.
  const joined = (one?.config as { d?: string } | undefined)?.d ?? "";
  expect(pathBounds(joined)).toEqual({
    maxX: 180,
    maxY: 100,
    minX: 0,
    minY: 0,
  });
  expect(groupVectors([shape])).toBeNull();
});
