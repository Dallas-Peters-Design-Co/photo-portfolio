import type { BoardItem } from "../../types";

/**
 * How see-through a text or picture layer is, 0 to 1, set in the frame
 * editor. Kept in `config.opacity`, where a shape already keeps its own, so
 * one slider reads the same for every layer. A shape is left out here: its
 * drawing applies its opacity itself, and doing it twice would square it.
 *
 * Anything that isn't a layer (a node, a frame) is always fully opaque, so a
 * node's own settings can never fade it.
 */
export const layerOpacity = (item: BoardItem): number => {
  const isLayer =
    item.kind === "text" ||
    item.kind === "note" ||
    item.kind === "reference" ||
    item.kind === "photo";
  if (!isLayer) {
    return 1;
  }
  const value = (item.config as { opacity?: unknown } | null)?.opacity;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 1;
};

/** The CSS for it: nothing at all when fully opaque. */
export const opacityCss = (item: BoardItem): number | undefined => {
  const value = layerOpacity(item);
  return value < 1 ? value : undefined;
};

/** The opacity the editor's slider shows, a shape's included. */
export const opacityOf = (item: BoardItem): number => {
  if (item.kind === "drawing") {
    const value = (item.config as { opacity?: unknown } | null)?.opacity;
    return typeof value === "number" && Number.isFinite(value) ? value : 1;
  }
  return layerOpacity(item);
};

/** The patch that sets a layer's opacity, shape or not. */
export const withOpacity = (
  item: BoardItem,
  value: number
): Partial<BoardItem> => ({
  config: {
    ...(item.config ?? {}),
    opacity: Math.round(Math.min(1, Math.max(0, value)) * 100) / 100,
  },
});
