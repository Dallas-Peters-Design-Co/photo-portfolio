import { describe, expect, it } from "vitest";
import { containedBy } from "./graph";

const box = (
  id: string,
  kind: string,
  x: number,
  y: number,
  w: number,
  h: number
) => ({
  height: h,
  id,
  kind,
  width: w,
  x,
  y,
});

describe("containedBy", () => {
  it("gives an item to the smaller frame it sits in", () => {
    const outer = box("o", "frame", 0, 0, 1000, 1000);
    const inner = box("i", "frame", 100, 100, 300, 300);
    const pic = box("p", "reference", 150, 150, 50, 50);
    expect(containedBy(outer, [outer, inner, pic])).toEqual([]);
    expect(containedBy(inner, [outer, inner, pic])).toEqual([pic]);
  });

  it("doesn't empty two same-size frames stacked on the same spot", () => {
    const a = box("a", "frame", 0, 0, 3600, 5400);
    const b = box("b", "frame", 0, 0, 3600, 5400);
    const words = box("t", "text", 200, 200, 1000, 300);
    expect(containedBy(a, [a, b, words])).toEqual([words]);
    expect(containedBy(b, [a, b, words])).toEqual([words]);
  });
});
