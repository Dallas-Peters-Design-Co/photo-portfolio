import { blobsTool } from "./generators/blobs";
import { ditherTool } from "./generators/dither";
import { flowTool } from "./generators/flow";
import { gradientTool } from "./generators/gradient";
import { gridBoxesTool } from "./generators/gridBoxes";
import { halftoneTool } from "./generators/halftone";
import { isoBlocksTool } from "./generators/isoBlocks";
import { lineWavesTool } from "./generators/lineWaves";
import { liquidTool } from "./generators/liquid";
import { meshTool } from "./generators/mesh";
import { mosaicTool } from "./generators/mosaic";
import { patternTool } from "./generators/pattern";
import { pixelFieldTool } from "./generators/pixelField";
import { radialTool } from "./generators/radial";
import { typeEchoTool } from "./generators/typeEcho";
import type { ImageTool, StudioParam, StudioValues } from "./types";

/** Every image tool in the Studio, in the order the panel lists them. */
export const IMAGE_TOOLS: ImageTool[] = [
  meshTool,
  liquidTool,
  patternTool,
  blobsTool,
  gradientTool,
  mosaicTool,
  flowTool,
  ditherTool,
  gridBoxesTool,
  pixelFieldTool,
  halftoneTool,
  typeEchoTool,
  radialTool,
  lineWavesTool,
  isoBlocksTool,
];

/** Neutral colours for when no brand is chosen. */
export interface StudioToolInfo {
  blurb: string;
  group: "Colour" | "Images" | "Type";
  id: string;
  name: string;
}

/** Every tool, for the Studio's list and the insert palette. */
export const STUDIO_TOOLS: StudioToolInfo[] = [
  ...IMAGE_TOOLS.map(({ blurb, id, name }) => ({
    blurb,
    group: "Images" as const,
    id,
    name,
  })),
  {
    blurb:
      "Coolors-style palettes: Space for a new one, lock colours, harmonies, from a photo, save to the brand.",
    group: "Colour",
    id: "palette",
    name: "Palette Generator",
  },
  {
    blurb:
      "Tints and shades, 50 to 950, of every brand colour, as CSS, Tailwind or JSON.",
    group: "Colour",
    id: "ramps",
    name: "Color Ramps",
  },
  {
    blurb:
      "Text styles and spacing steps in the brand fonts: sizes, weights, leading, tracking, case. Saves to the kit and its DESIGN.md.",
    group: "Type",
    id: "type-scale",
    name: "Type & Spacing Scale",
  },
];

export const DEFAULT_PALETTE = [
  "#1e3dff",
  "#ff6b4a",
  "#ffd166",
  "#0b0f1a",
  "#f6f4ef",
];

export const defaultsOf = (params: StudioParam[]): StudioValues =>
  Object.fromEntries(
    params.map((p) => {
      if (p.type === "seed") {
        return [p.key, 1];
      }
      if (p.type === "image") {
        return [p.key, null];
      }
      if (
        p.type === "colors" ||
        p.type === "remap" ||
        p.type === "tiles" ||
        p.type === "letters"
      ) {
        return [p.key, ""];
      }
      return [p.key, p.default];
    })
  );
