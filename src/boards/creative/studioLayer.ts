import { portfolioService } from "../../services/portfolioService";
import type { BoardItem } from "../../types";
import { newItemId } from "../io/newItemId";
import type { StudioRecipe } from "../studio/types";
import { newImage } from "./creativeModel";

const aspectOfFile = (file: File): Promise<number> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth / img.naturalHeight || 1);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(1);
    };
    img.src = url;
  });

/**
 * A picture from the Studio, uploaded and made a layer of the frame: fitted
 * inside it, or (as a background) filling it, below every other layer.
 */
export const studioLayer = async (
  file: File,
  frame: BoardItem,
  items: BoardItem[],
  layers: BoardItem[],
  asBackground: boolean
): Promise<BoardItem> => {
  const { url } = await portfolioService.uploadImageFile(
    file,
    undefined,
    "boards/uploads"
  );
  if (!asBackground) {
    return newImage(frame, items, url, await aspectOfFile(file));
  }
  return {
    ...newImage(frame, items, url, frame.width / frame.height, 1),
    height: frame.height,
    width: frame.width,
    x: frame.x,
    y: frame.y,
    z: Math.min(1, ...layers.map((l) => l.z)) - 1,
  };
};

/**
 * A placed Studio picture, made again with changed settings: a new layer with
 * the new picture takes the old one's place (same box, same stacking) and
 * carries the new recipe, so it can be changed again later.
 *
 * A new layer rather than a new picture on the old one, because a board save
 * never changes an existing item's picture (api/boards/[id].ts: an item's
 * source is fixed once it exists). Patching the URL looked right until the
 * next reload brought the old picture back.
 */
export const replaceStudioLayer = async (
  file: File,
  recipe: StudioRecipe,
  layer: BoardItem,
  swap: (oldId: string, next: BoardItem) => void
): Promise<void> => {
  const { url } = await portfolioService.uploadImageFile(
    file,
    undefined,
    "boards/uploads"
  );
  swap(layer.id, {
    ...layer,
    config: { ...(layer.config ?? {}), studio: recipe },
    id: newItemId(),
    imageUrl: url,
    recipeUseId: null,
    thumbUrl: url,
  });
};
