import { describe, expect, it } from "vitest";
import type { ReviewMark } from "./review.js";
import { handleIndexes, moveMark, movePoint } from "./reviewMarkEdit.js";

const arrow: ReviewMark = {
  id: "a",
  kind: "arrow",
  points: [
    [0.1, 0.2],
    [0.5, 0.6],
  ],
};

describe("handleIndexes", () => {
  it("gives an arrow, box and highlight both ends, and a pen stroke none", () => {
    expect(handleIndexes(arrow)).toEqual([0, 1]);
    expect(handleIndexes({ ...arrow, kind: "box" })).toEqual([0, 1]);
    expect(
      handleIndexes({
        ...arrow,
        kind: "pen",
        points: [
          [0, 0],
          [0.1, 0.1],
          [0.2, 0.1],
        ],
      })
    ).toEqual([]);
  });
});

describe("movePoint", () => {
  it("moves the tip and leaves the tail, kept on the picture", () => {
    expect(movePoint(arrow, 1, { x: 0.9, y: 1.4 }).points).toEqual([
      [0.1, 0.2],
      [0.9, 1],
    ]);
  });
});

describe("moveMark", () => {
  it("moves every point by the same amount", () => {
    const moved = moveMark(arrow, 0.1, 0.1).points;
    expect(moved[0]?.[0]).toBeCloseTo(0.2);
    expect(moved[1]?.[1]).toBeCloseTo(0.7);
  });

  it("stops at the edge instead of squashing the mark", () => {
    const moved = moveMark(arrow, -0.5, 0.9).points;
    expect(moved[0]?.[0]).toBeCloseTo(0);
    expect(moved[1]?.[0]).toBeCloseTo(0.4);
    expect(moved[1]?.[1]).toBeCloseTo(1);
    expect(moved[0]?.[1]).toBeCloseTo(0.6);
  });
});
