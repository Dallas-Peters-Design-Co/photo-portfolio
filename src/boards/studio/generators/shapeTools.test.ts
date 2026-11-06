import { beforeAll, describe, expect, it } from "vitest";
import type { ImageTool, StudioValues } from "../types";
import { halftoneTool } from "./halftone";
import { isoBlocksTool } from "./isoBlocks";
import { lineWavesTool } from "./lineWaves";
import { radialTool } from "./radial";
import { typeEchoTool } from "./typeEcho";
import { fontReady } from "./vectorType";

const ctx = {
  height: 200,
  image: null,
  palette: ["#8fd6e8", "#2f86ff", "#c5cf3a", "#4cc46a"],
  width: 300,
};

const defaultsOf = (tool: ImageTool): StudioValues => {
  const v: StudioValues = { seed: 3 };
  for (const p of tool.params) {
    if ("default" in p) {
      v[p.key] = p.default;
    }
  }
  return v;
};

describe("the shape and pattern tools", () => {
  // Type Echo's letters are outlines from the font files, loaded first.
  beforeAll(async () => {
    await fontReady("DM Sans", 800);
    await fontReady("Anton", 400);
  });

  const tools = [
    halftoneTool,
    typeEchoTool,
    radialTool,
    lineWavesTool,
    isoBlocksTool,
  ];

  it("draw every look as an SVG of the size asked", () => {
    for (const tool of tools) {
      for (const look of tool.looks ?? []) {
        const v = { ...defaultsOf(tool), ...look.values };
        if (v.source === "picture") {
          continue;
        }
        const svg = tool.render(v, ctx);
        expect(svg, `${tool.name}: ${look.name}`).toContain('width="300"');
        expect(svg.length).toBeGreaterThan(200);
      }
    }
  });

  it("sets Type Echo's words as vector outlines, not as a picture", () => {
    const svg = typeEchoTool.render(defaultsOf(typeEchoTool), ctx);
    expect(svg).toContain("<path");
    expect(svg).not.toContain("<image");
  });

  it("draws the same picture for the same seed", () => {
    const v = { ...defaultsOf(lineWavesTool), source: "noise" };
    expect(lineWavesTool.render(v, ctx)).toBe(lineWavesTool.render(v, ctx));
  });

  it("puts larger halftone marks where the source is stronger", () => {
    const v = {
      ...defaultsOf(halftoneTool),
      fieldAngle: 0,
      source: "gradient",
    };
    const radii = [
      ...halftoneTool
        .render(v, ctx)
        .matchAll(/cx="([\d.]+)"[^>]*r="([\d.]+)"/g),
    ].map((m) => [Number(m[1]), Number(m[2])] as const);
    const left = radii.filter(([x]) => x < 60).map(([, r]) => r);
    const right = radii.filter(([x]) => x > 240).map(([, r]) => r);
    expect(Math.max(...right)).toBeGreaterThan(Math.max(...left));
  });
});
