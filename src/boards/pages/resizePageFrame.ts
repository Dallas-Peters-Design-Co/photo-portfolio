import { stepsOf } from "../../../config/conceptSteps.js";
import {
  boxOf,
  type PageBox,
  type PageDesign,
  pageDesignOf,
} from "../../../config/pageDesign.js";
import type { BoardItem } from "../../types";

/** Board units and page pixels may differ. Keep the zoom established before the drag. */
export function resizePageFrame(
  original: BoardItem,
  size: { width: number; height: number }
): PageDesign | null {
  const page = pageDesignOf(original.config);
  if (original.kind !== "frame" || !page) {
    return null;
  }
  const density = page.width / original.width;
  const width = Math.max(320, Math.min(4096, Math.round(size.width * density)));
  const height = Math.max(
    200,
    Math.min(12_000, Math.round(size.height * density))
  );
  if (width === page.width && height === page.height) {
    return page;
  }
  const boxes: Record<string, PageBox> = {};
  for (const step of stepsOf(page.concept)) {
    for (const [index, el] of step.elements.entries()) {
      const box = boxOf(page, el.id, index);
      // Keep symmetric gutters on full-width sections. Other columns retain
      // their horizontal share of the page, leaving type and spacing alone.
      const right = page.width - box.x - box.width;
      const stretch = box.x === right && box.width >= page.width / 2;
      const x = stretch
        ? Math.min(box.x, Math.floor(width / 2))
        : Math.round((box.x * width) / page.width);
      boxes[el.id] = {
        ...box,
        width: Math.max(
          1,
          stretch
            ? width - 2 * x
            : Math.round(((box.x + box.width) * width) / page.width) - x
        ),
        x,
      };
    }
  }
  return { ...page, boxes, height, width };
}
