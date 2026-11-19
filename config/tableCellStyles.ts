import type { ConceptCellLook, ConceptTableColumn } from "./conceptTable.js";

export interface TableCellStyle {
  box?: ConceptCellLook;
  /** Last resolved kit appearance for pages published without a kit. */
  look?: ConceptCellLook;
  overrides?: ConceptCellLook;
  styleId?: string;
}

export function cellColumn(
  column: ConceptTableColumn,
  row: number
): ConceptTableColumn {
  const cell = column.cells?.[row];
  if (!(cell && (cell.styleId || cell.overrides))) {
    return column;
  }
  return {
    ...column,
    look: { ...(cell.look ?? column.look), ...cell.overrides },
  };
}

export function cleanCells(
  value: unknown,
  count: number,
  clean: (value: unknown) => ConceptCellLook | undefined,
  validId: RegExp
) {
  if (!value || typeof value !== "object") {
    return;
  }
  const cells: Record<number, TableCellStyle> = {};
  for (let row = 0; row < count; row += 1) {
    const raw = (value as Record<number, TableCellStyle>)[row];
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const styleId =
      typeof raw.styleId === "string" && validId.test(raw.styleId)
        ? raw.styleId
        : undefined;
    const box = clean(raw.box);
    const overrides = clean(raw.overrides);
    const look = styleId && clean(raw.look);
    if (box || styleId || overrides) {
      cells[row] = {
        ...(box && { box }),
        ...(overrides && { overrides }),
        ...(styleId && { styleId }),
        ...(look && { look }),
      };
    }
  }
  return Object.keys(cells).length ? cells : undefined;
}

export function withoutRow<T>(
  values: Record<number, T>,
  index: number
): Record<number, T> {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => Number(key) !== index)
      .map(([key, value]) => [
        Number(key) > index ? Number(key) - 1 : Number(key),
        value,
      ])
  );
}

export function progressCellBar(column: ConceptTableColumn) {
  const { look } = column;
  return {
    color: look?.accentColor ?? look?.color ?? column.color ?? "currentColor",
    height: look?.barHeight ?? 6,
    radius: look?.radius ?? 999,
    track:
      look?.background ?? "color-mix(in srgb, currentColor 12%, transparent)",
  };
}
