import { describe, expect, it } from "vitest";
import type { BoardItem } from "../../types";
import { downloadableFrames, frameFileNames, svgOfPng } from "./downloadFrames";

const item = (over: Partial<BoardItem>): BoardItem =>
  ({
    body: "",
    config: null,
    height: 100,
    id: crypto.randomUUID(),
    kind: "frame",
    rotation: 0,
    width: 100,
    x: 0,
    y: 0,
    z: 1,
    ...over,
  }) as BoardItem;

describe("downloadableFrames", () => {
  it("keeps designed frames, in reading order, and leaves nodes out", () => {
    const lower = item({ body: "Lower", config: { designed: true }, y: 500 });
    const upper = item({ body: "Upper", config: { designed: true }, y: 0 });
    const workflow = item({ body: "Workflow" });
    const social = item({ kind: "op", nodeType: "social" });
    expect(
      downloadableFrames([lower, workflow, social, upper]).map((f) => f.body)
    ).toEqual(["Upper", "Lower"]);
  });
});

describe("frameFileNames", () => {
  it("names each frame once, numbering repeats and the unnamed", () => {
    expect(
      frameFileNames([
        item({ body: "Hero / 1080×1080" }),
        item({ body: "Hero / 1080×1080" }),
        item({ body: "" }),
      ])
    ).toEqual(["hero-1080-1080", "hero-1080-1080-2", "frame-3"]);
  });
});

describe("svgOfPng", () => {
  it("holds the picture at the frame's size", () => {
    const svg = svgOfPng(new Uint8Array([1, 2, 3]), 1080, 1350);
    expect(svg).toContain('width="1080" height="1350"');
    expect(svg).toContain('viewBox="0 0 1080 1350"');
    expect(svg).toContain("data:image/png;base64,AQID");
  });
});
