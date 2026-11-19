import type { PageDesign } from "./pageDesign.js";
import {
  DEFAULT_FRAME_GRID,
  type FrameGrid,
  type GridCell,
} from "./pageFrameGrid.js";
import type { ReviewConceptElement } from "./reviewConcept.js";

/** Place the two full-width bands above the working area. Authored positions
 * distinguish the two sidebars even when the layer stack is in paint order. */
export function workspaceGrid(
  page: PageDesign,
  elements: ReviewConceptElement[]
): FrameGrid | undefined {
  const navbar = elements.find((el) => el.kind === "navbar");
  const verticalOrder = (a: ReviewConceptElement, b: ReviewConceptElement) =>
    (page.boxes[a.id]?.y ?? 0) - (page.boxes[b.id]?.y ?? 0);
  const [cards] = elements
    .filter(
      (el) =>
        el.kind === "group" &&
        el.group?.elements.some((child) => child.kind === "card")
    )
    .sort(verticalOrder);
  const panels = elements
    .filter((el) => el.kind === "panel")
    .sort((a, b) => {
      const left = page.boxes[a.id];
      const right = page.boxes[b.id];
      if (left && right && left.x !== right.x) {
        return left.x - right.x;
      }
      return (
        Number(a.panelToggleSide === "left") -
        Number(b.panelToggleSide === "left")
      );
    });
  if (!(navbar && cards) || panels.length !== 2) {
    return undefined;
  }
  const main = elements
    .filter((el) => el !== navbar && el !== cards && !panels.includes(el))
    .sort(verticalOrder);
  if (!main.length) {
    return undefined;
  }

  const [left, right] = panels;
  const cells: Record<string, GridCell> = { ...page.grid?.cells };
  const place = (
    id: string,
    row: number,
    column: number,
    columnSpan = 1,
    rowSpan = 1
  ) => {
    cells[id] = { column, columnSpan, row, rowSpan };
  };
  place(navbar.id, 1, 1, 3);
  place(cards.id, 2, 1, 3);
  place(left.id, 3, 1, 1, main.length);
  place(right.id, 3, 3, 1, main.length);
  for (const [index, el] of main.entries()) {
    place(el.id, 3 + index, 2);
  }

  return {
    ...DEFAULT_FRAME_GRID,
    cells,
    gap: page.grid?.gap ?? 0,
    rows: main.length === 1 ? "auto auto 1fr" : "auto auto",
  };
}
