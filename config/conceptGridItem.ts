import type { GridCell } from "./pageFrameGrid.js";

export type GridPlacement = Partial<GridCell>;

export const gridFields = {
  column: "Column",
  columnSpan: "Column span",
  row: "Row",
  rowSpan: "Row span",
} as const;

export function cleanGridPlacement(value: unknown): {
  gridPlacement?: GridPlacement;
} {
  if (!value || typeof value !== "object") {
    return {};
  }
  const placement: GridPlacement = {};
  for (const key of Object.keys(gridFields) as (keyof GridCell)[]) {
    const number = (value as GridPlacement)[key];
    if (typeof number === "number" && Number.isFinite(number) && number >= 1) {
      placement[key] = Math.min(
        key.startsWith("column") ? 24 : 256,
        Math.floor(number)
      );
    }
  }
  return Object.keys(placement).length ? { gridPlacement: placement } : {};
}

export function gridItemStyle(item: GridPlacement, columns: number) {
  const column = item.column && Math.min(item.column, columns);
  const span = Math.min(item.columnSpan ?? 1, columns - (column ?? 1) + 1);
  return {
    gridColumn: `${column ?? "auto"} / span ${span}`,
    gridRow: `${item.row ?? "auto"} / span ${item.rowSpan ?? 1}`,
  };
}
