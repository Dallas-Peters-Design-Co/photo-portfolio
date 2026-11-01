import { describe, expect, it } from "vitest";
import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { clipPathFor, frameLocks, liftToFrames } from "./frameLock";

const box = (
  id: string,
  kind: BoardItem["kind"],
  x: number,
  y: number,
  width: number,
  height: number
): BoardItem => ({ ...BLANK_ITEM, height, id, kind, width, x, y, z: 1 });

describe("frameLock", () => {
  it("locks what sits in a design frame to it, and clips to its edges", () => {
    const frame = box("f", "frame", 0, 0, 100, 100);
    const pic = box("p", "reference", 60, 60, 80, 20);
    const outside = box("o", "text", 300, 300, 10, 10);
    const locks = frameLocks([frame, pic, outside]);
    expect(locks.get("p")?.owner).toBe("f");
    expect(locks.has("o")).toBe(false);
    expect(locks.has("f")).toBe(false);
    expect(clipPathFor(pic, frame)).toBe(
      "polygon(-60px -60px, 40px -60px, 40px 40px, -60px 40px)"
    );
    expect(clipPathFor(box("in", "text", 10, 10, 10, 10), frame)).toBeNull();
  });

  it("leaves a frame of nodes alone, so a workflow stays clickable", () => {
    const group = box("g", "frame", 0, 0, 400, 400);
    const node = box("n", "op", 10, 10, 50, 50);
    const pic = box("p", "reference", 100, 100, 50, 50);
    expect(frameLocks([group, node, pic]).size).toBe(0);
  });

  it("hands a nested frame's contents to the outermost design frame", () => {
    const outer = box("a", "frame", 0, 0, 400, 400);
    const inner = box("b", "frame", 100, 100, 100, 100);
    const pic = box("p", "reference", 120, 120, 20, 20);
    const twin = box("c", "frame", 0, 0, 400, 400);
    const locks = frameLocks([outer, inner, pic, twin]);
    expect(["a", "c"]).toContain(locks.get("p")?.owner);
    expect(locks.get("p")?.clip).toEqual({
      height: 100,
      width: 100,
      x: 100,
      y: 100,
    });
  });

  it("swaps a selected layer for its frame", () => {
    const locks = frameLocks([
      box("f", "frame", 0, 0, 100, 100),
      box("p", "reference", 10, 10, 10, 10),
    ]);
    const same = new Set(["x"]);
    expect(liftToFrames(same, locks)).toBe(same);
    expect([...liftToFrames(new Set(["p", "x"]), locks)]).toEqual(["f", "x"]);
  });
});
