import { ShaderView } from "../shaders/ShaderView";
import type { ShaderConfig } from "../shaders/shaderConfig";
import { type OffscreenSize, renderOffscreen } from "./renderOffscreen";

/**
 * A shader stack, rendered to a file.
 *
 * The half that turns a shader from somewhere a picture ends up into something
 * you can keep. `config/nodeTypes.ts` states the limitation this removes: a
 * shader item has no output port and nothing reads from it, because until now
 * there was no rendered file for anything to read.
 *
 * Rendered offscreen at a fixed size rather than captured from the item on the
 * board — see renderOffscreen for why. The wired picture is passed in so the
 * export matches what the canvas was showing rather than the bare stack.
 */

/** Big enough to print from, small enough to store without thinking about it. */
export const SHADER_EXPORT_SIZE = 2048;
/** The longest side a render is allowed: past this a GPU canvas may refuse. */
export const SHADER_EXPORT_MAX = 4096;

/**
 * The size to render a stack at: the wired picture's own shape, or a square.
 *
 * A stack with nothing wired in has no composition of its own to preserve — it
 * fills whatever frame it is given — so it is rendered square. One over a
 * picture is that picture restyled, and should come back at the picture's
 * size, capped so a poster does not ask the GPU for more than it will give.
 */
export const shaderExportSize = async (
  imageUrl: string | null
): Promise<OffscreenSize> => {
  if (!imageUrl) {
    return { height: SHADER_EXPORT_SIZE, width: SHADER_EXPORT_SIZE };
  }
  const picture = await new Promise<{ height: number; width: number } | null>(
    (resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({ height: img.naturalHeight, width: img.naturalWidth });
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    }
  );
  if (!(picture && picture.width > 0 && picture.height > 0)) {
    return { height: SHADER_EXPORT_SIZE, width: SHADER_EXPORT_SIZE };
  }
  const k = Math.min(
    1,
    SHADER_EXPORT_MAX / Math.max(picture.width, picture.height)
  );
  return {
    height: Math.max(1, Math.round(picture.height * k)),
    width: Math.max(1, Math.round(picture.width * k)),
  };
};

/** A PNG of this stack at `size`, or at the wired picture's size when none is given. */
export const renderShaderStack = async (
  config: ShaderConfig,
  imageUrl: string | null,
  size?: OffscreenSize | number
): Promise<Blob> => {
  const at =
    typeof size === "number"
      ? { height: size, width: size }
      : (size ?? (await shaderExportSize(imageUrl)));
  return await renderOffscreen(
    <ShaderView config={config} imageUrl={imageUrl} />,
    at
  );
};
