import { describe, expect, it } from "vitest";
import type { ReviewMark, ReviewPin } from "../../../config/review.js";
import { moveMarkup, orderPins, readingOrder } from "./reviewEditing";

const pin = (y: number): ReviewPin => ({
  body: "",
  id: `p${y}`,
  kind: "issue",
  title: "",
  x: 0.3,
  y,
});

const box: ReviewMark = {
  id: "m",
  kind: "box",
  points: [
    [0.1, 0.2],
    [0.4, 0.3],
  ],
};

describe("moveMarkup", () => {
  it("keeps a pin at the same place on a taller recapture", () => {
    const moved = moveMarkup(
      { marks: [box], pins: [pin(0.5)] },
      { height: 2000, url: "a", width: 1440 },
      { height: 4000, url: "b", width: 1440 }
    );
    expect(moved.pins[0]).toMatchObject({ x: 0.3, y: 0.25 });
    expect(moved.marks[0]?.points).toEqual([
      [0.1, 0.1],
      [0.4, 0.15],
    ]);
    expect(moved.lost).toBe(0);
  });

  it("treats a 2x upload and a 1x capture of the same page as the same page", () => {
    const moved = moveMarkup(
      { marks: [], pins: [pin(0.5)] },
      { height: 4000, url: "a", width: 2880 },
      { height: 2000, url: "b", width: 1440 }
    );
    expect(moved.pins[0]?.y).toBeCloseTo(0.5);
  });

  it("counts notes past the end of a shorter page and keeps them at the edge", () => {
    const moved = moveMarkup(
      { marks: [], pins: [pin(0.2), pin(0.9)] },
      { height: 4000, url: "a", width: 1440 },
      { height: 2000, url: "b", width: 1440 }
    );
    expect(moved.pins.map((p) => p.y)).toEqual([0.4, 1]);
    expect(moved.lost).toBe(1);
  });
});

describe("orderPins", () => {
  it("follows the given ids and keeps any it does not name at the end", () => {
    const [a, b, c] = [pin(0.1), pin(0.2), pin(0.3)];
    if (!(a && b && c)) {
      throw new Error("fixtures");
    }
    expect(orderPins([a, b, c], [c.id, a.id]).map((p) => p.id)).toEqual([
      c.id,
      a.id,
      b.id,
    ]);
  });
});

describe("readingOrder", () => {
  const image = { height: 1440, url: "x", width: 1440 };
  const at = (id: string, x: number, y: number): ReviewPin => ({
    ...pin(y),
    id,
    x,
  });

  it("reads down the page", () => {
    expect(
      readingOrder([at("low", 0.5, 0.8), at("high", 0.5, 0.1)], image)
    ).toEqual(["high", "low"]);
  });

  it("reads one line left to right even when the pins are not level", () => {
    expect(
      readingOrder(
        [at("right", 0.9, 0.5), at("left", 0.1, 0.52), at("below", 0.1, 0.7)],
        image
      )
    ).toEqual(["left", "right", "below"]);
  });
});
