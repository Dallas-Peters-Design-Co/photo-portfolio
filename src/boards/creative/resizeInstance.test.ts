import { expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { resizeStep } from "./resize";

/**
 * A component scales as one thing from a corner (its shape kept, so its type
 * and marks don't squash), stretches from a side, and Shift frees a corner.
 */
const instance = {
  height: 100,
  id: "i",
  kind: "component",
  width: 400,
  x: 0,
  y: 0,
} as BoardItem;
const drag = (handle: "se" | "e") => ({
  handle,
  id: "i",
  kind: "resize" as const,
  origin: { height: 100, width: 400, x: 0, y: 0 },
  originFont: null,
  startX: 0,
  startY: 0,
});
const step = (handle: "se" | "e", shift: boolean) =>
  resizeStep(drag(handle), instance, {
    alt: true,
    dx: 400,
    dy: 10,
    frame: { height: 2000, width: 2000, x: 0, y: 0 },
    others: [],
    shift,
    threshold: 0,
  }).box;

it("keeps a component's shape from a corner", () => {
  expect(step("se", false)).toMatchObject({ height: 200, width: 800 });
});

it("stretches it from a side, or from a corner with Shift", () => {
  expect(step("e", false)).toMatchObject({ height: 100, width: 800 });
  expect(step("se", true)).toMatchObject({ height: 110, width: 800 });
});
