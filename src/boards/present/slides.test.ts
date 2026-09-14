import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { framesInReadingOrder, slidesOf } from "./slides";

/**
 * The order a deck plays in.
 *
 * Worth pinning because it is the whole point: a presentation that shows the
 * mockups before the covers, or reads a row of frames as a column, is a
 * presentation somebody has to apologise for.
 */

const item = (over: Partial<BoardItem>): BoardItem =>
  ({
    body: null,
    config: null,
    creditName: null,
    creditUrl: null,
    fontSize: null,
    height: 100,
    id: Math.random().toString(36).slice(2),
    imageUrl: null,
    kind: "photo",
    nodeType: null,
    photoId: null,
    result: null,
    width: 100,
    x: 0,
    y: 0,
    z: 0,
    ...over,
  }) as BoardItem;

const frame = (over: Partial<BoardItem>) =>
  item({ height: 1000, kind: "frame", width: 1000, ...over });

describe("framesInReadingOrder", () => {
  it("reads a hand-drawn row left to right before the row below", () => {
    const a = frame({ body: "A", x: 0, y: 40 });
    const b = frame({ body: "B", x: 1200, y: 0 });
    const c = frame({ body: "C", x: 0, y: 1400 });
    expect(framesInReadingOrder([c, a, b]).map((f) => f.body)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });
});

describe("slidesOf", () => {
  it("opens with the title, then a section card and its pictures per frame", () => {
    const covers = frame({ body: "Covers", x: 0, y: 0 });
    const mockups = frame({ body: "Mockups", x: 1200, y: 0 });
    const items = [
      mockups,
      covers,
      item({ imageUrl: "c2.png", x: 600, y: 100 }),
      item({ imageUrl: "c1.png", x: 100, y: 100 }),
      item({ imageUrl: "m1.png", x: 1300, y: 100 }),
      // A note has no picture and makes no slide.
      item({ body: "a note", kind: "note", x: 100, y: 500 }),
      // Outside every frame: not part of the deck.
      item({ imageUrl: "loose.png", x: 3000, y: 3000 }),
    ];
    const slides = slidesOf({ items, title: "Centrifuge" }, "Unruly Chain");
    expect(
      slides.map((s) => (s.kind === "picture" ? s.url : `${s.kind}:${s.title}`))
    ).toEqual([
      "title:Centrifuge",
      "section:Covers",
      "c1.png",
      "c2.png",
      "section:Mockups",
      "m1.png",
    ]);
    const [, , first] = slides;
    expect(
      first.kind === "picture" && first.index === 1 && first.count === 2
    ).toBe(true);
  });

  it("skips the section card for an unnamed frame and an empty one", () => {
    const unnamed = frame({ x: 0, y: 0 });
    const empty = frame({ body: "Empty", x: 1200, y: 0 });
    const items = [unnamed, empty, item({ imageUrl: "p.png", x: 100, y: 100 })];
    expect(slidesOf({ items, title: "T" }).map((s) => s.kind)).toEqual([
      "title",
      "picture",
    ]);
  });
});
