import { describe, expect, it } from "vitest";
import type { BoardItem, BoardWire } from "../types";
import { videoInputsOf } from "./io/videoInputs";
import { outputImagesOf, outputListOf } from "./itemOutput";

/**
 * A Bundle, read from the canvas side.
 *
 * Mirrors the server's bundleOutputsOf; the two agreeing is the whole of it.
 * The case that matters is the one the node exists for: one Bundle feeding a
 * Video node's references, prompt and source clip at once.
 */
const item = (id: string, fields: Partial<BoardItem>): BoardItem =>
  ({
    config: {},
    height: 10,
    id,
    kind: "op",
    width: 10,
    x: 0,
    y: 0,
    ...fields,
  }) as unknown as BoardItem;

const wire = (
  source: string,
  sourcePort: string,
  target: string,
  targetPort: string
): BoardWire => ({
  id: `${source}:${sourcePort}->${target}:${targetPort}`,
  sourceItemId: source,
  sourcePort,
  targetItemId: target,
  targetPort,
});

const A = "https://example.com/a.jpg";
const B = "https://example.com/b.jpg";
const CLIP = "https://example.com/c.mp4";
const HELD = "https://example.com/uploaded.jpg";

const items = [
  item("a", { imageUrl: A, kind: "photo", nodeType: null }),
  item("b", { imageUrl: B, kind: "photo", nodeType: null }),
  item("note", { body: "a slow push in", kind: "note", nodeType: null }),
  item("clip", {
    nodeType: "video",
    result: { url: CLIP } as BoardItem["result"],
  }),
  item("bundle", {
    config: { images: [HELD], text: "golden hour\n\nwide" },
    nodeType: "bundle",
  }),
  item("video", { nodeType: "video" }),
];

const wires = [
  wire("a", "out", "bundle", "images"),
  wire("b", "out", "bundle", "images"),
  wire("note", "out", "bundle", "text"),
  wire("clip", "out", "bundle", "video"),
  wire("bundle", "images", "video", "references"),
  wire("bundle", "text", "video", "prompt"),
  wire("bundle", "video", "video", "video"),
];

const graph = { items, wires };
const bundle = items.find((i) => i.id === "bundle") ?? null;

describe("a Bundle", () => {
  it("hands wired pictures, then uploaded ones, out of its Images port", () => {
    expect(outputImagesOf(bundle, graph)).toEqual([A, B, HELD]);
  });

  it("hands wired lines then typed ones out of its Text port", () => {
    expect(outputListOf(bundle, graph)).toEqual([
      "a slow push in",
      "golden hour",
      "wide",
    ]);
  });

  it("feeds a Video node's references, prompt and clip from one node", () => {
    const video = items.find((i) => i.id === "video");
    if (!video) {
      throw new Error("fixture is missing its video node");
    }
    expect(videoInputsOf(video, graph)).toEqual({
      end: null,
      image: null,
      prompts: ["a slow push in", "golden hour", "wide"],
      references: [A, B, HELD],
      video: CLIP,
    });
  });
});
