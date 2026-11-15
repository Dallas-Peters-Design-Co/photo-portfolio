import { applyTransform, type CropRect } from "../../editor/engine/export";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const cropOf = (config: Readonly<Record<string, unknown>>): CropRect => {
  const value = config.crop;
  if (value && typeof value === "object") {
    const { height, width, x, y } = value as Record<string, unknown>;
    if (
      isFiniteNumber(x) &&
      isFiniteNumber(y) &&
      isFiniteNumber(width) &&
      isFiniteNumber(height) &&
      x >= 0 &&
      y >= 0 &&
      width > 0 &&
      height > 0 &&
      x + width <= 1 &&
      y + height <= 1
    ) {
      return { height, width, x, y };
    }
    throw new Error("Choose a crop rectangle inside the image.");
  }
  throw new Error("Choose a crop area in the crop editor first.");
};

/** The same pixel geometry is used by toolbar runs and image exports. */
export const transformImage = (
  source: HTMLCanvasElement,
  toolId: string,
  config: Readonly<Record<string, unknown>>
): HTMLCanvasElement => {
  if (toolId === "flip-horizontal") {
    const flipped = document.createElement("canvas");
    flipped.width = source.width;
    flipped.height = source.height;
    const context = flipped.getContext("2d");
    if (!context) {
      throw new Error("This browser cannot draw to a canvas");
    }
    context.translate(source.width, 0);
    context.scale(-1, 1);
    context.drawImage(source, 0, 0);
    return flipped;
  }
  if (toolId === "crop") {
    return applyTransform(source, {
      crop: cropOf(config),
      rotation: 0,
    });
  }
  const rotation = isFiniteNumber(config.degrees) ? config.degrees : 90;
  return applyTransform(source, { crop: null, rotation });
};
