import { expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { fitPatch } from "./textFit";

const box = (textStyle: unknown = null) =>
  ({ height: 100, textStyle, width: 400, x: 1000, y: 500 }) as BoardItem;
const size = { height: 140, width: 300 };

it("keeps the pinned point of a fitted box's words where it was", () => {
  expect(fitPatch(box(), "both", size)).toEqual({
    height: 140,
    width: 300,
    x: 1000,
    y: 500,
  });
  expect(fitPatch(box({ align: "center" }), "both", size)?.x).toBe(1050);
  expect(
    fitPatch(box({ align: "right", verticalAlign: "bottom" }), "both", size)
  ).toMatchObject({ x: 1100, y: 460 });
});

it("leaves the width alone when fitting the height, and a box that fits", () => {
  expect(fitPatch(box(), "height", size)).toEqual({ height: 140, y: 500 });
  expect(fitPatch(box(), "both", { height: 100.5, width: 400 })).toBeNull();
});
