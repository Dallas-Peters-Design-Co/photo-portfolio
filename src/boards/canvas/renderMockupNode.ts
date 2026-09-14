import { loadImage } from "./halftoneGl";
import {
  isMockupTemplateId,
  MOCKUP_TEMPLATES,
  renderTemplate,
  wrapBackWindow,
} from "./mockupTemplate";
import { readColor } from "./renderCoverNode";
import { isTrim, TRIMS } from "./wrapLayout";

/**
 * Rendering a Mockup node to a file.
 *
 * The work is mockupTemplate's; this reads the settings, loads the cover,
 * and turns the canvas into a PNG. Output size is the template's own window
 * — a few thousand pixels wide, never upscaled.
 */

export type MockupSettings = Record<string, unknown>;

export class MockupError extends Error {}

export interface MockupSources {
  cover: string | null;
  /** The print wrap, for a template that shows the back. */
  wrap: string | null;
}

export const renderMockup = async (
  config: MockupSettings,
  sources: MockupSources
): Promise<Blob> => {
  if (!sources.cover) {
    throw new MockupError("Wire a cover into this node to make a mockup.");
  }
  const id = isMockupTemplateId(config.template)
    ? (config.template as string)
    : MOCKUP_TEMPLATES[0].id;
  const template = MOCKUP_TEMPLATES.find((t) => t.id === id);
  if (!template) {
    throw new MockupError("That mockup template is not available.");
  }

  const [cover, wrap] = await Promise.all([
    loadImage(sources.cover),
    sources.wrap ? loadImage(sources.wrap) : Promise.resolve(null),
  ]);
  const [trimW, trimH] = TRIMS[isTrim(config.trim) ? config.trim : "6x9"];
  const canvas = await renderTemplate(template.base, cover, {
    back: wrap
      ? {
          image: wrap,
          window: wrapBackWindow(wrap.naturalWidth / wrap.naturalHeight, trimW, trimH),
        }
      : null,
    spine: readColor(config.spine, "#293341"),
  });

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new MockupError("The mockup could not be saved as a picture.");
  }
  return blob;
};
