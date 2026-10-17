import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { SENT_WIDTH, sentItems } from "./sendToBoard";

const placed = (over: Partial<BoardItem>): BoardItem =>
  ({
    height: 300,
    id: "a",
    kind: "note",
    width: 300,
    x: 0,
    y: 0,
    z: 1,
    ...over,
  }) as BoardItem;

const urls = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ url: `https://x.test/${i}.png` }));

describe("sentItems", () => {
  it("makes reference items carrying the picture, with fresh ids", () => {
    const items = sentItems(urls(2), []);
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.kind).toBe("reference");
      expect(item.imageUrl).toBe(item.thumbUrl);
      expect(item.result).toBeNull();
    }
    expect(items[0]?.id).not.toBe(items[1]?.id);
  });

  it("lands to the right of everything already there, above it in the stack", () => {
    const existing = [
      placed({ width: 500, x: 100, y: 400, z: 3 }),
      placed({ id: "b", width: 200, x: 900, y: 150, z: 7 }),
    ];
    const items = sentItems(urls(1), existing);
    expect(items[0]?.x).toBeGreaterThan(1100);
    expect(items[0]?.y).toBe(150);
    expect(items[0]?.z).toBe(8);
  });

  it("starts at a sensible origin on an empty board", () => {
    const [first] = sentItems(urls(1), []);
    expect(first?.x).toBe(200);
    expect(first?.y).toBe(200);
  });

  it("keeps each picture's proportions and never overlaps rows", () => {
    const items = sentItems(
      [
        { height: 2000, url: "tall", width: 1000 },
        { url: "a" },
        { url: "b" },
        { url: "c" },
        { url: "next-row" },
      ],
      []
    );
    expect(items[0]?.height).toBe(SENT_WIDTH * 2);
    expect(items[1]?.height).toBe(SENT_WIDTH);
    const firstRowBottom = Math.max(
      ...items.slice(0, 4).map((i) => i.y + i.height)
    );
    expect(items[4]?.y).toBeGreaterThan(firstRowBottom);
    expect(items[4]?.x).toBe(items[0]?.x);
  });
});
