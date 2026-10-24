import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { saveTargetOf } from "./saveTarget";

const item = (patch: Partial<BoardItem>): BoardItem =>
  ({ id: "a", kind: "op", ...patch }) as BoardItem;

describe("saveTargetOf", () => {
  it("saves a Clip node's file, named after the upload", () => {
    const clip = item({
      config: { clipUrl: "https://blob/x/beach.mp4", name: "Beach day.mp4" },
      nodeType: "clip",
    });
    expect(saveTargetOf(clip, null)).toEqual({
      label: "Beach day",
      noun: "clip",
      url: "https://blob/x/beach.mp4",
    });
  });

  it("offers nothing for an empty Clip node", () => {
    expect(saveTargetOf(item({ config: {}, nodeType: "clip" }), null)).toBe(
      null
    );
  });

  it("saves a picture as a picture, and a pinned clip as a clip", () => {
    const photo = item({ body: "Dunes", kind: "photo" });
    expect(saveTargetOf(photo, "https://blob/d.jpg")?.noun).toBe("picture");
    expect(saveTargetOf(photo, "https://blob/d.mp4")?.noun).toBe("clip");
    expect(saveTargetOf(photo, "https://blob/d.jpg")?.label).toBe("Dunes");
  });

  it("offers nothing with nothing picked", () => {
    expect(saveTargetOf(null, "https://blob/d.jpg")).toBe(null);
  });
});
