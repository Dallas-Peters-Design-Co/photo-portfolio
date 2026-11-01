import { portfolioService } from "../../services/portfolioService";
import type { BoardItem } from "../../types";
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
