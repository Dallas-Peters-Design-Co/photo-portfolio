import { describe, expect, it } from "vitest";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { deckSlides, emailHtml, wordsOf } from "./exportOutputs";

const item = (over: Partial<BoardItem>): BoardItem =>
  ({
    ...BLANK_ITEM,
    height: 100,
    id: "x",
    kind: "text",
    width: 100,
    x: 0,
    y: 0,
    z: 0,
    ...over,
  }) as BoardItem;

const slide = (id: string, x: number, y: number) =>
  item({
    body: "Deck · Slide · 16:9 · 1920×1080",
    height: 540,
    id,
    kind: "frame",
    width: 960,
    x,
    y,
  });

describe("deckSlides", () => {
  it("reads the slides in rows, top to bottom then left to right", () => {
    const items = [
      slide("c", 0, 700),
      slide("b", 1000, 20),
      slide("a", 0, 0),
      item({
        body: "Instagram · Post · square · 1080×1080",
        id: "ad",
        kind: "frame",
      }),
    ];
    expect(deckSlides(items).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("email", () => {
  it("puts the words in the alt text and preview, and links the picture", () => {
    const words = wordsOf([
      item({ body: "Spring  sale", id: "h", y: 10 }),
      item({ body: "Everything 20% off", id: "b", y: 80 }),
      item({ id: "shape", kind: "drawing" }),
    ]);
    expect(words).toEqual(["Spring sale", "Everything 20% off"]);
    const html = emailHtml({
      height: 1200,
      link: "https://shop.test/?a=1&b=2",
      title: "Spring",
      words,
    });
    expect(html).toContain('alt="Spring sale — Everything 20% off"');
    expect(html).toContain('href="https://shop.test/?a=1&amp;b=2"');
    expect(html).toContain(">Everything 20% off</div>");
    expect(html).toContain('width="600" height="1200"');
  });
});
