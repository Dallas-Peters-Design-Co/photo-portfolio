import { describe, expect, it } from "vitest";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem, BoardWire } from "../../types";
import { shadersShapedToFrames } from "./shaderShape";

const item = (
  over: Pick<BoardItem, "height" | "id" | "kind" | "width">
): BoardItem => ({ ...BLANK_ITEM, x: 0, y: 0, z: 1, ...over }) as BoardItem;

const frame = item({ height: 540, id: "f", kind: "frame", width: 540 });
const shader = item({ height: 625, id: "s", kind: "shader", width: 969 });
const wire: BoardWire = {
  id: "w",
  sourceItemId: "f",
  sourcePort: "out",
  targetItemId: "s",
  targetPort: "image",
};

describe("shadersShapedToFrames", () => {
  it("gives a shader newly fed a frame the frame's shape, keeping its width", () => {
    const out = shadersShapedToFrames([frame, shader], [], [wire]);
    expect(out.find((i) => i.id === "s")).toMatchObject({
      height: 969,
      width: 969,
    });
  });

  it("leaves a shader alone once wired, so a resize by hand stays", () => {
    const items = [frame, shader];
    expect(shadersShapedToFrames(items, [wire], [wire])).toBe(items);
  });

  it("only reshapes for a frame, not a photo", () => {
    const photo = item({ height: 100, id: "f", kind: "photo", width: 400 });
    const items = [photo, shader];
    expect(shadersShapedToFrames(items, [], [wire])).toBe(items);
  });
});
