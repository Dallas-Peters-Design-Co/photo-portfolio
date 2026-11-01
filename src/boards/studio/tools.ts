import { blobsTool } from "./generators/blobs";
import { gradientTool } from "./generators/gradient";
import { meshTool } from "./generators/mesh";
import { mosaicTool } from "./generators/mosaic";
import { patternTool } from "./generators/pattern";
import type { ImageTool, StudioParam, StudioValues } from "./types";

/** Every image tool in the Studio, in the order the panel lists them. */
export const IMAGE_TOOLS: ImageTool[] = [
  meshTool,
  patternTool,
  blobsTool,
  gradientTool,
  mosaicTool,
];

/** Neutral colours for when no brand is chosen. */
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
      return [p.key, p.default];
    })
  );
