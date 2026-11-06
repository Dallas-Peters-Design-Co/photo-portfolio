import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { outputImagesOf } from "../itemOutput";
import { currentFrameRender, frameKeyOf } from "./frameRenderKey";

const item = (patch: Partial<BoardItem>) =>
  ({
    body: null,
    config: null,
    fontSize: null,
    height: 20,
    id: "x",
    imageUrl: null,
    kind: "reference",
    width: 20,
    x: 10,
    y: 10,
    z: 1,
    ...patch,
  }) as BoardItem;

const frame = item({
  height: 100,
  id: "f",
  kind: "frame",
  width: 100,
  x: 0,
  y: 0,
  z: 0,
});
const pic = item({ id: "p", imageUrl: "https://x/p.jpg" });
const words = item({ body: "Assets", id: "t", kind: "text" });

describe("a designed frame as one picture", () => {
  const items = [frame, pic, words];
  const drawn = {
    ...frame,
    config: {
      renderKey: frameKeyOf(frame, items),
      renderUrl: "https://x/f.png",
    },
  };

  it("hands over its render while the design is unchanged", () => {
    const now = [drawn, pic, words];
    expect(currentFrameRender(drawn, now)).toBe("https://x/f.png");
    expect(outputImagesOf(drawn, { items: now, wires: [] })).toEqual([
      "https://x/f.png",
    ]);
  });

  it("drops it once a layer changes, back to the pictures on it", () => {
    const edited = [drawn, pic, { ...words, body: "Hours" }];
    expect(currentFrameRender(drawn, edited)).toBeNull();
    expect(outputImagesOf(drawn, { items: edited, wires: [] })).toEqual([
      "https://x/p.jpg",
    ]);
  });
});
