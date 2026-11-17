import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { collectablesFor } from "./collectFrames";

const item = (over: Partial<BoardItem>): BoardItem =>
  ({
    body: "",
    height: 100,
    id: "x",
    kind: "photo",
    width: 100,
    x: 0,
    y: 0,
    z: 1,
    ...over,
  }) as BoardItem;

const frame = item({
  config: { designed: true },
  height: 400,
  id: "f",
  kind: "frame",
  width: 400,
  z: 0,
});
const photo = item({ id: "p", imageUrl: "https://x/p.png", x: 10, y: 10 });
const outside = item({ id: "o", imageUrl: "https://x/o.png", x: 900 });
const graph = { items: [frame, photo, outside], wires: [] };

describe("collectablesFor", () => {
  it("keeps a designed frame as one design, not its parts", () => {
    expect(collectablesFor([frame, photo], null, graph)).toEqual([{ frame }]);
  });

  it("keeps pictures outside the frame as pictures", () => {
    expect(collectablesFor([frame, outside], null, graph)).toEqual([
      { frame },
      { url: "https://x/o.png" },
    ]);
  });

  it("saves the designed frame under the pointer when nothing is selected", () => {
    expect(collectablesFor([], frame, graph)).toEqual([{ frame }]);
  });
});
