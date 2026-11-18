import type { BoardItem, BoardWire } from "../../types";

/**
 * A shader takes the shape of a frame wired into it.
 *
 * A frame's picture is the frame's shape; a shader of another shape shows it
 * letterboxed (Contain) or cropped (Cover), and either way part of the design
 * is missing: a square frame in a wide shader lost a third of itself. So when
 * a frame is newly wired into a shader, the shader keeps its width and takes
 * the frame's proportions. Only on a new wire: a shader resized by hand after
 * that keeps the size it was given.
 */
export const shadersShapedToFrames = (
  items: BoardItem[],
  before: readonly BoardWire[],
  after: readonly BoardWire[]
): BoardItem[] => {
  const added = after.filter((w) => !before.some((b) => b.id === w.id));
  const heights = new Map<string, number>();
  for (const wire of added) {
    const frame = items.find(
      (i) => i.id === wire.sourceItemId && i.kind === "frame"
    );
    const shader = items.find(
      (i) => i.id === wire.targetItemId && i.kind === "shader"
    );
    if (frame && shader && frame.width > 0 && frame.height > 0) {
      heights.set(
        shader.id,
        Math.round((shader.width * frame.height) / frame.width)
      );
    }
  }
  if (heights.size === 0) {
    return items;
  }
  return items.map((item) => {
    const height = heights.get(item.id);
    return height === undefined || height === item.height
      ? item
      : { ...item, height };
  });
};
