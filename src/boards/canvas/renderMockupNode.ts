import { loadImage } from "./halftoneGl";
import {
  isMockupTemplateId,
  MOCKUP_TEMPLATES,
  renderTemplate,
} from "./mockupTemplate";
import { readColor } from "./renderCoverNode";

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

  const cover = await loadImage(sources.cover);
  const canvas = await renderTemplate(template.base, cover, {
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
