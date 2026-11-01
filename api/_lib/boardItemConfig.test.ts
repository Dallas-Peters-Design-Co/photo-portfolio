import { describe, expect, it } from "vitest";
import { MAX_BUNDLE_HELD } from "../../config/nodes/bundle.js";
import { DRAW_TOOLS as CLIENT_DRAW_TOOLS } from "../../src/boards/drawing/drawing.js";
import {
  DRAW_TOOLS,
  parseDrawingConfig,
  parseImageConfig,
  parseNodeConfig,
} from "./boardItemConfig.js";

/**
 * What a save keeps of a node's config.
 *
 * Everything not declared is dropped on purpose, so anything the app writes
 * for itself has to be named here or it lasts only until the next save. That
 * is how pictures dropped on a Bundle went missing on reload.
 */
describe("parseNodeConfig", () => {
  it("keeps what was uploaded onto a Bundle, pictures and clips", () => {
    expect(
      parseNodeConfig("bundle", {
        clips: ["https://example.com/c.mp4", 7],
        images: ["https://example.com/a.jpg"],
        text: "wide",
      })
    ).toEqual({
      clips: ["https://example.com/c.mp4"],
      images: ["https://example.com/a.jpg"],
      text: "wide",
    });
  });

  it("caps a Bundle's held lists at what the node allows", () => {
    const many = Array.from(
      { length: MAX_BUNDLE_HELD + 5 },
      (_, i) => `https://example.com/${i}.jpg`
    );
    const kept = parseNodeConfig("bundle", { images: many });
    expect(kept?.images).toHaveLength(MAX_BUNDLE_HELD);
  });

  it("keeps held lists only on a Bundle", () => {
    expect(
      parseNodeConfig("prompt", { images: ["https://example.com/a.jpg"] })
    ).toEqual({});
  });

  it("keeps a Clip node's file and name", () => {
    expect(
      parseNodeConfig("clip", {
        clipUrl: "https://example.com/c.mp4",
        name: "take 3.mov",
      })
    ).toEqual({ clipUrl: "https://example.com/c.mp4", name: "take 3.mov" });
  });
});

describe("parseDrawingConfig", () => {
  it("keeps every shape the board can draw (all but the mask brush)", () => {
    for (const tool of CLIENT_DRAW_TOOLS.filter((t) => t !== "mask")) {
      expect(DRAW_TOOLS.has(tool)).toBe(true);
    }
  });

  it("keeps a star's points and depth, and a line's ends", () => {
    expect(
      parseDrawingConfig({
        innerRatio: 2,
        sides: 40.4,
        stroke: "#000",
        strokeWidth: 3,
        tool: "star",
      })
    ).toMatchObject({ innerRatio: 0.95, sides: 24, tool: "star" });
    expect(
      parseDrawingConfig({
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 0 },
        ],
        stroke: "#000",
        strokeWidth: 3,
        tool: "arrow",
      })?.points
    ).toHaveLength(2);
  });
});

describe("parseImageConfig", () => {
  it("keeps a picture's corner radius and nothing else", () => {
    expect(parseImageConfig({ radius: 24, script: "x" })).toEqual({
      radius: 24,
    });
    expect(parseImageConfig({ radius: 0 })).toBeNull();
    expect(parseImageConfig(null)).toBeNull();
  });
});
