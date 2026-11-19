import { type ConceptIconSvg, conceptIconName } from "./conceptIcon.js";
import type { ConceptTable, ConceptTableColumn } from "./conceptTable.js";

export type CellIcons = Partial<Record<"start" | "end", string | null>>;

/** Missing inherits the kit icon on that side. Null explicitly clears it. */
export function tableItemIcon(
  column: ConceptTableColumn,
  row: number,
  side: keyof CellIcons,
  drawings: ConceptTable["icons"]
) {
  const override = column.itemIcons?.[row]?.[side];
  const { look } = column;
  const inherited = side === "start" ? look?.iconName : look?.iconEndName;
  const name = override === undefined ? inherited : override;
  if (!name) {
    return;
  }
  const styleSvg = side === "start" ? look?.iconSvg : look?.iconEndSvg;
  return {
    name,
    svg:
      (override === undefined ? styleSvg : undefined) ??
      drawings?.[name] ??
      (name === inherited ? styleSvg : undefined),
  };
}

export function cleanItemIcons(
  value: ConceptTableColumn["itemIcons"],
  count: number
) {
  const icons: Record<number, CellIcons> = {};
  for (let row = 0; row < count; row += 1) {
    const cell: CellIcons = {};
    for (const side of ["start", "end"] as const) {
      const raw = value?.[row]?.[side];
      const name = conceptIconName(raw);
      if (raw === null || name) {
        cell[side] = name;
      }
    }
    if (Object.keys(cell).length) {
      icons[row] = cell;
    }
  }
  return Object.keys(icons).length ? icons : undefined;
}

export function tableIconDrawings(
  table: ConceptTable,
  lookup: (name: string) => ConceptIconSvg | undefined
): ConceptTable {
  const icons = { ...table.icons };
  for (const column of table.columns) {
    for (const [row] of table.rows.entries()) {
      for (const side of ["start", "end"] as const) {
        const item = tableItemIcon(column, row, side, icons);
        if (item && !item.svg) {
          const svg = lookup(item.name);
          if (svg) {
            icons[item.name] = svg;
          }
        }
      }
    }
  }
  return { ...table, icons };
}
