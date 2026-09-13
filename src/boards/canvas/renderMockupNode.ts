import { loadImage } from "./halftoneGl";
import { MockupGlError, paintMockup } from "./mockupGl";
import { isMockupView, mockupScene, wrapWindows } from "./mockupScene";
import { readColor } from "./renderCoverNode";
import { isTrim, TRIMS } from "./wrapLayout";

/**
 * Rendering a Mockup node to a file.
 *
 * Scene maths in mockupScene, pixels in mockupGl; this is the glue that reads
 * the settings, loads the pictures and captures the canvas. Output is
 * 2400×1800 — a 4:3 frame that fits a slide or an email without being
 * resized, and big enough to crop.
 */

export type MockupSettings = Record<string, unknown>;

export const MOCKUP_WIDTH = 2400;
export const MOCKUP_HEIGHT = 1800;

export interface MockupSources {
  cover: string | null;
  wrap: string | null;
}

const number = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && Number.isFinite(Number(value))
      ? Number(value)
      : fallback;

export const renderMockup = async (
  config: MockupSettings,
  sources: MockupSources
): Promise<Blob> => {
  if (!sources.cover) {
    throw new MockupGlError("Wire a cover into this node to make a mockup.");
  }
  const [cover, wrap] = await Promise.all([
    loadImage(sources.cover),
    sources.wrap ? loadImage(sources.wrap) : Promise.resolve(null),
  ]);

  const [trimW, trimH] = TRIMS[isTrim(config.trim) ? config.trim : "6x9"];
  const windows = wrap
    ? wrapWindows(wrap.naturalWidth / wrap.naturalHeight, trimW, trimH)
    : null;
  const thicknessIn = windows
    ? windows.spineIn
    : number(config.thickness, 0.75);

  const scene = mockupScene({
    coverAspect: cover.naturalWidth / Math.max(1, cover.naturalHeight),
    height: MOCKUP_HEIGHT,
    thickness: thicknessIn / trimW,
    view: isMockupView(config.view) ? config.view : "angled",
    width: MOCKUP_WIDTH,
    wrap: windows,
  });

  const canvas = document.createElement("canvas");
  canvas.width = MOCKUP_WIDTH;
  canvas.height = MOCKUP_HEIGHT;
  paintMockup(canvas, scene, cover, wrap, {
    background: readColor(config.background, "#ece7de"),
    paint: readColor(config.spine, "#293341"),
  });

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new MockupGlError("The mockup could not be saved as a picture.");
  }
  return blob;
};
