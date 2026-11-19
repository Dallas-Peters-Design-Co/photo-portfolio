import {
  boxOf,
  type PageBox,
  type PageDesign,
} from "../../../config/pageDesign.js";
import { gridCells } from "../../../config/pageFrameGrid.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";

/** Convert the rendered flex/grid children back to free-placement frame coordinates. */
function groupChildBoxes(group: ReviewConceptElement, width: number) {
  const boxes: Record<string, PageBox> = {};
  const container = document.querySelector(
    `.page-builder__stage [data-page-layer="${CSS.escape(group.id)}"]`
  );
  const sheet = container
    ?.closest(".page-design__sheet")
    ?.getBoundingClientRect();
  const items = container?.querySelector(".concept-group__items");
  const children = group.group?.elements ?? [];
  if (!sheet?.width || items?.children.length !== children.length) {
    return boxes;
  }
  const scale = width / sheet.width;
  for (const [index, child] of children.entries()) {
    const el = items.children[index];
    let rect = el.getBoundingClientRect();
    if (!rect.width) {
      const range = document.createRange();
      range.selectNodeContents(el);
      rect = range.getBoundingClientRect();
    }
    if (rect.width && rect.height) {
      boxes[child.id] = {
        height: Math.round(rect.height * scale),
        width: Math.round(rect.width * scale),
        x: Math.round((rect.x - sheet.x) * scale),
        y: Math.round((rect.y - sheet.y) * scale),
      };
    }
  }
  return boxes;
}

export function ungroupPlacement(
  page: PageDesign,
  elements: ReviewConceptElement[],
  group: ReviewConceptElement,
  box: PageBox
) {
  const boxes = { ...page.boxes };
  for (const [index, root] of elements.entries()) {
    boxes[root.id] ??= boxOf(page, root.id, index);
  }
  Object.assign(boxes, groupChildBoxes(group, page.width));
  const first = group.group?.elements[0];
  if (!first) {
    return { boxes };
  }
  boxes[first.id] ??= box;
  const { grid } = page;
  if (!grid) {
    return { boxes };
  }
  const cells = { ...grid.cells };
  if (grid.enabled) {
    Object.assign(cells, Object.fromEntries(gridCells(grid, elements)));
  }
  if (cells[group.id]) {
    cells[first.id] = cells[group.id];
  }
  return { boxes, grid: { ...grid, cells } };
}
