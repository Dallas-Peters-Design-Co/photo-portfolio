import { portfolioService } from "../../services/portfolioService";
import type { StudioRecipe, StudioValues } from "./types";

/**
 * Keeping how a Studio picture was made, so the layer it became can be opened
 * in the Studio again (types.ts: StudioRecipe).
 */

interface Size {
  h: number;
  label: string;
  w: number;
}

/** The sizes on offer, with an edited picture's own size first if it's new. */
export const sizesWith = (sizes: readonly Size[], recipe?: StudioRecipe) => {
  if (
    !recipe ||
    sizes.some((s) => s.w === recipe.size.w && s.h === recipe.size.h)
  ) {
    return [...sizes];
  }
  const { h, w } = recipe.size;
  return [{ h, label: `As placed ${w}×${h}`, w }, ...sizes];
};

export const sizeIndexFor = (sizes: readonly Size[], recipe?: StudioRecipe) =>
  recipe
    ? Math.max(
        0,
        sizes.findIndex((s) => s.w === recipe.size.w && s.h === recipe.size.h)
      )
    : 0;

/**
 * A lasting address for the picture a tool worked from: the board address it
 * was picked from, or, for one uploaded from this computer, a copy put in
 * blob storage now.
 */
const lastingImage = async (
  local: string | null,
  source: string | null
): Promise<string | null> => {
  if (source || !local) {
    return source;
  }
  try {
    const blob = await (await fetch(local)).blob();
    const file = new File([blob], "studio-source", {
      type: blob.type || "image/png",
    });
    const { url } = await portfolioService.uploadImageFile(
      file,
      undefined,
      "boards/uploads"
    );
    return url;
  } catch {
    // The picture can be chosen again when editing; the settings still keep.
    return null;
  }
};

export const recipeFor = async (
  tool: string,
  values: StudioValues,
  size: { h: number; w: number },
  image: { local: string | null; source: string | null }
): Promise<StudioRecipe> => ({
  image: await lastingImage(image.local, image.source),
  size: { h: size.h, w: size.w },
  tool,
  values,
});
