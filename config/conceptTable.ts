import { isConceptPaint } from "./conceptColor.js";
import {
  type ConceptIconSvg,
  cleanIconSvg,
  conceptIconName,
} from "./conceptIcon.js";
import { cleanIcon } from "./conceptKinds.js";
import { type ConceptShadow, cleanShadow } from "./conceptShadow.js";
import {
  cleanCells,
  type TableCellStyle,
  withoutRow,
} from "./tableCellStyles.js";
import { type CellIcons, cleanItemIcons } from "./tableItemIcons.js";

/**
 * A concept table: typed columns, and rows of cell text.
 *
 * The type belongs to the column, the way a real table is built — a Status
 * column is all tags — so each cell is only text, read by its column's type:
 *
 *   text     one line
 *   stacked  "Main line\nSmaller line" — a name over an email
 *   tag      one coloured label
 *   chips    "Design, Web" — several small labels
 *   icon     an icon's name ("FavouriteIcon"); its drawing is kept in
 *            `icons`, so the public page draws it without the library
 *   button   the button's label
 *   progress "60\nDesign handoff" — the percent, then an optional line
 *            that says what is in progress
 *
 * Tables made before this stored only `options` (the column names) and drew
 * one row of "Example"; `tableOf` reads those the same way.
 */
export type ConceptCellKind =
  | "text"
  | "stacked"
  | "tag"
  | "chips"
  | "icon"
  | "button"
  | "progress";

export type ButtonStyle = "solid" | "outline";

/**
 * How a tag, chip or button cell is drawn when its column follows a brand
 * kit component style: that style's look, copied in whenever the review is
 * drawn (config/conceptStyle.ts applyColumnStyles) and kept as a fallback.
 */
export interface ConceptCellLook extends ReturnType<typeof cleanIcon> {
  accentColor?: string;
  background?: string;
  barHeight?: number;
  borderColor?: string;
  borderWidth?: number;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  /** The style's own, so a table's button is as tall as the kit's button. */
  lineHeight?: number;
  paddingX?: number;
  paddingY?: number;
  radius?: number;
  shadow?: ConceptShadow;
  showValue?: boolean;
}

export type { CellIcons } from "./tableItemIcons.js";

export interface ConceptTableColumn {
  /** Button columns: filled with the colour, or outlined in it. */
  buttonStyle?: ButtonStyle;
  cells?: Record<number, TableCellStyle>;
  /** Tag, chip, icon and button colour, as hex. */
  color?: string;
  /** Decorative icons for each row in this column. */
  itemIcons?: Record<number, CellIcons>;
  kind: ConceptCellKind;
  label: string;
  /** The kit style's look, while the column follows one. */
  look?: ConceptCellLook;
  /** The kit component style the cells follow: a badge or button style. */
  styleId?: string;
  /** The column's width in px; without one it sizes to its content. */
  width?: number;
}

/** A column's width in px. */
export const COLUMN_WIDTH = { max: 640, min: 40 } as const;

/** Which kind of kit style a column's cells can follow. */
export const CELL_STYLE_KIND: Partial<
  Record<ConceptCellKind, "badge" | "button" | "progress">
> = { button: "button", chips: "badge", progress: "progress", tag: "badge" };

/** Status pills and tag lists can use either kit component. */
export function cellStyleKinds(kind: ConceptCellKind): readonly string[] {
  if (kind === "chips") {
    return ["tag", "badge"];
  }
  if (kind === "tag") {
    return ["badge", "tag"];
  }
  return CELL_STYLE_KIND[kind] ? [kind] : [];
}

/** Where lines are drawn: none, between rows (the default), or every cell. */
export type TableLines = "none" | "rows" | "grid";

export interface ConceptTableBorders {
  /** Hex; without one, lines are a faint tint of the text colour. */
  color?: string;
  lines: TableLines;
  /** A box around the whole table. */
  outline: boolean;
  /** In px, 1–4. */
  width: number;
}

/** The header row's own colours; without them it takes the table's. */
export interface ConceptTableHeader {
  background?: string;
  color?: string;
}

export interface ConceptTable {
  /** Absent on tables made before borders were settings: the default. */
  borders?: ConceptTableBorders;
  columns: ConceptTableColumn[];
  header?: ConceptTableHeader;
  /** The drawing of every icon an icon cell names, by name. */
  icons?: Record<string, ConceptIconSvg>;
  /** One string per column, in column order. */
  rows: string[][];
}

export const CELL_KINDS: readonly ConceptCellKind[] = [
  "text",
  "stacked",
  "tag",
  "chips",
  "icon",
  "button",
  "progress",
];

export const TABLE_LINES: readonly TableLines[] = ["none", "rows", "grid"];
export const MAX_BORDER_WIDTH = 4;

export const DEFAULT_BORDERS: ConceptTableBorders = {
  lines: "rows",
  outline: false,
  width: 1,
};

export const MAX_TABLE_COLUMNS = 8;
export const MAX_TABLE_ROWS = 20;
// Matches the 100 an older table's column names (options) were allowed.
const MAX_LABEL = 100;
const MAX_CELL = 200;
const CHIP_SPLIT = /\s*,\s*/;

export const DEFAULT_TABLE: ConceptTable = {
  columns: [
    { kind: "stacked", label: "Project" },
    { color: "#12b76a", kind: "tag", label: "Status" },
    { color: "#6172f3", kind: "chips", label: "Tags" },
  ],
  rows: [
    ["Website redesign\nAcme Co.", "Active", "Design, Web"],
    ["Brand refresh\nNorthwind", "Paused", "Brand"],
  ],
};

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

/** `{ [key]: value }` when the value is a hex colour, else nothing. */
const optionalHex = <K extends string>(
  key: K,
  value: unknown
): Partial<Record<K, string>> =>
  typeof value === "string" && isConceptPaint(value)
    ? ({ [key]: value } as Record<K, string>)
    : {};

const STYLE_ID = /^[a-z0-9-]{1,64}$/i;

const optionalPaint = <K extends string>(key: K, value: unknown) =>
  value === "transparent"
    ? ({ [key]: value } as Partial<Record<K, string>>)
    : optionalHex(key, value);

const num = <K extends string>(
  key: K,
  value: unknown,
  min: number,
  max: number
): Partial<Record<K, number>> =>
  typeof value === "number" && Number.isFinite(value)
    ? ({ [key]: Math.min(max, Math.max(min, value)) } as Record<K, number>)
    : {};

/** A cell look, checked on its own terms: colours, sizes and a shadow. */
const cleanCellLook = (value: unknown): ConceptCellLook | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const shadow = cleanShadow(raw.shadow);
  const look: ConceptCellLook = {
    ...cleanIcon("button", raw),
    ...optionalHex("accentColor", raw.accentColor),
    ...num("barHeight", raw.barHeight, 2, 24),
    ...(typeof raw.showValue === "boolean" && { showValue: raw.showValue }),
    ...optionalPaint("background", raw.background),
    ...optionalPaint("borderColor", raw.borderColor),
    ...num("borderWidth", raw.borderWidth, 0, 8),
    ...optionalHex("color", raw.color),
    ...num("fontSize", raw.fontSize, 8, 72),
    ...num("fontWeight", raw.fontWeight, 100, 900),
    ...num("lineHeight", raw.lineHeight, 0.8, 3),
    ...num("paddingX", raw.paddingX, 0, Number.POSITIVE_INFINITY),
    ...num("paddingY", raw.paddingY, 0, Number.POSITIVE_INFINITY),
    ...num("radius", raw.radius, 0, 999),
    ...(shadow ? { shadow } : {}),
  };
  return Object.keys(look).length > 0 ? look : undefined;
};

const cleanColumn = (value: unknown, rowCount: number): ConceptTableColumn => {
  const raw = (value ?? {}) as Partial<ConceptTableColumn>;
  const kind = CELL_KINDS.includes(raw.kind as ConceptCellKind)
    ? (raw.kind as ConceptCellKind)
    : "text";
  const linked =
    CELL_STYLE_KIND[kind] !== undefined &&
    typeof raw.styleId === "string" &&
    STYLE_ID.test(raw.styleId);
  const look = cleanCellLook(raw.look);
  const cells = cleanCells(raw.cells, rowCount, cleanCellLook, STYLE_ID);
  const itemIcons =
    kind === "icon" ? undefined : cleanItemIcons(raw.itemIcons, rowCount);
  return {
    ...(kind === "button" && raw.buttonStyle === "outline"
      ? { buttonStyle: "outline" as const }
      : {}),
    ...optionalHex("color", raw.color),
    kind,
    ...(itemIcons ? { itemIcons } : {}),
    ...(cells && { cells }),
    label: text(raw.label, MAX_LABEL),
    ...(look ? { look } : {}),
    ...(linked ? { styleId: raw.styleId } : {}),
    // 0 or nothing is "fit the content"; anything else is held in range.
    ...(typeof raw.width === "number" &&
    Number.isFinite(raw.width) &&
    raw.width > 0
      ? {
          width: Math.min(
            COLUMN_WIDTH.max,
            Math.max(COLUMN_WIDTH.min, Math.round(raw.width))
          ),
        }
      : {}),
  };
};

const cleanBorders = (value: unknown): ConceptTableBorders | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Partial<ConceptTableBorders>;
  const width =
    typeof raw.width === "number" && Number.isFinite(raw.width)
      ? Math.min(MAX_BORDER_WIDTH, Math.max(1, Math.round(raw.width)))
      : DEFAULT_BORDERS.width;
  return {
    ...optionalHex("color", raw.color),
    lines: TABLE_LINES.includes(raw.lines as TableLines)
      ? (raw.lines as TableLines)
      : DEFAULT_BORDERS.lines,
    outline: raw.outline === true,
    width,
  };
};

/** Every row padded or cut to the column count, so cells always line up. */
export const cleanTable = (value: unknown): ConceptTable | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Partial<ConceptTable>;
  const inputRows = (Array.isArray(raw.rows) ? raw.rows : []).slice(
    0,
    MAX_TABLE_ROWS
  );
  const columns = (Array.isArray(raw.columns) ? raw.columns : [])
    .slice(0, MAX_TABLE_COLUMNS)
    .map((column) => cleanColumn(column, inputRows.length));
  if (columns.length === 0) {
    return undefined;
  }
  const rows = inputRows.map((row) =>
    columns.map((_, index) =>
      text(Array.isArray(row) ? row[index] : "", MAX_CELL)
    )
  );
  const borders = cleanBorders(raw.borders);
  const header = {
    ...optionalHex("background", raw.header?.background),
    ...optionalHex("color", raw.header?.color),
  };
  const icons = cleanIcons(raw.icons, columns, rows);
  return {
    ...(borders ? { borders } : {}),
    columns,
    ...(Object.keys(header).length > 0 ? { header } : {}),
    ...(icons ? { icons } : {}),
    rows,
  };
};

/**
 * Only the drawings an icon cell still names, each checked: a stale icon is
 * dropped, and nothing but plain shapes is kept (see conceptIcon.ts).
 */
const cleanIcons = (
  value: unknown,
  columns: ConceptTableColumn[],
  rows: string[][]
): Record<string, ConceptIconSvg> | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const names = new Set<string>();
  for (const [index, column] of columns.entries()) {
    for (const [rowIndex, row] of rows.entries()) {
      const cell = column.itemIcons?.[rowIndex];
      for (const name of [
        cell?.start,
        cell?.end,
        column.look?.iconName,
        column.look?.iconEndName,
        column.kind === "icon" ? conceptIconName(row[index]) : null,
      ]) {
        if (name) {
          names.add(name);
        }
      }
    }
  }
  const icons: Record<string, ConceptIconSvg> = {};
  for (const name of names) {
    const svg = cleanIconSvg(raw[name]);
    if (svg) {
      icons[name] = svg;
    }
  }
  return Object.keys(icons).length > 0 ? icons : undefined;
};

/** The table to draw: the stored one, or an older table read from its names. */
export const tableOf = ({
  options,
  table,
  text: name,
}: {
  options?: string[];
  table?: ConceptTable;
  text: string;
}): ConceptTable => {
  if (table) {
    return table;
  }
  const labels = options?.length ? options : [name || "Text"];
  return {
    columns: labels.map((label) => ({ kind: "text", label })),
    rows: [labels.map(() => "Example")],
  };
};

/** A chips cell's labels, empty ones dropped. */
export const chipsOf = (cell: string): string[] =>
  cell.split(CHIP_SPLIT).filter(Boolean);

/** A Progress cell's percentage: the number in its text, held to 0–100. */
export const progressOf = (cell: string): number => {
  const value = Number.parseFloat(cell);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
};

/** A Progress cell's line under or beside its bar: what is in progress. */
export const progressLabelOf = (cell: string): string =>
  cell.split("\n").slice(1).join(" ").trim();

/** A Progress cell from its percent and its line ("" for none). */
export const joinProgressCell = (percent: string, label: string): string =>
  label.trim() ? `${percent}\n${label.replace(LINE_BREAKS, " ")}` : percent;

/* Edits, each returning a new table. */

export const updateColumn = (
  table: ConceptTable,
  index: number,
  patch: Partial<ConceptTableColumn>
): ConceptTable => ({
  ...table,
  columns: table.columns.map((column, at) =>
    at === index ? { ...column, ...patch } : column
  ),
});

export const addColumn = (table: ConceptTable): ConceptTable =>
  table.columns.length >= MAX_TABLE_COLUMNS
    ? table
    : {
        ...table,
        columns: [...table.columns, { kind: "text", label: "Column" }],
        rows: table.rows.map((row) => [...row, ""]),
      };

/** The last column stays: a table needs one. */
export const removeColumn = (
  table: ConceptTable,
  index: number
): ConceptTable =>
  table.columns.length <= 1
    ? table
    : {
        ...table,
        columns: table.columns.filter((_, at) => at !== index),
        rows: table.rows.map((row) => row.filter((_, at) => at !== index)),
      };

const LINE_BREAKS = /\n+/g;

/**
 * Retypes a column. Leaving "Two lines" folds each cell onto one line, since
 * a one-line box would drop the second line on the next keystroke.
 */
export const setColumnKind = (
  table: ConceptTable,
  index: number,
  kind: ConceptCellKind
): ConceptTable => {
  const was = table.columns[index];
  // A style follows a kind of cell; changing to another kind drops it.
  const keepsStyle =
    was?.styleId !== undefined &&
    CELL_STYLE_KIND[kind] === CELL_STYLE_KIND[was.kind];
  const retyped = updateColumn(
    table,
    index,
    keepsStyle
      ? { kind }
      : {
          cells: was?.kind === kind ? was.cells : undefined,
          kind,
          look: undefined,
          styleId: undefined,
        }
  );
  if (kind === "stacked") {
    return retyped;
  }
  // A Progress cell holds a number; words become the line under a half-full
  // bar, so nothing typed is lost.
  const retext = (cell: string): string => {
    if (kind !== "progress") {
      return cell.replace(LINE_BREAKS, " ");
    }
    return Number.isFinite(Number.parseFloat(cell))
      ? cell
      : joinProgressCell("50", cell);
  };
  return {
    ...retyped,
    rows: retyped.rows.map((row) =>
      row.map((cell, at) => (at === index ? retext(cell) : cell))
    ),
  };
};

export const setCell = (
  table: ConceptTable,
  rowIndex: number,
  columnIndex: number,
  value: string
): ConceptTable => ({
  ...table,
  rows: table.rows.map((row, at) =>
    at === rowIndex
      ? row.map((cell, column) => (column === columnIndex ? value : cell))
      : row
  ),
});

export const addRow = (table: ConceptTable): ConceptTable =>
  table.rows.length >= MAX_TABLE_ROWS
    ? table
    : { ...table, rows: [...table.rows, table.columns.map(() => "")] };

export const updateBorders = (
  table: ConceptTable,
  patch: Partial<ConceptTableBorders>
): ConceptTable => ({
  ...table,
  borders: { ...(table.borders ?? DEFAULT_BORDERS), ...patch },
});

/**
 * Sets a header colour. Anything but hex (the picker's None is
 * "transparent") clears it, so the header falls back to the table's own.
 */
export const updateHeader = (
  table: ConceptTable,
  patch: Partial<ConceptTableHeader>
): ConceptTable => {
  const merged = { ...table.header, ...patch };
  const header: ConceptTableHeader = {
    ...optionalHex("background", merged.background),
    ...optionalHex("color", merged.color),
  };
  return { ...table, header };
};

/** Puts the columns in a new order, carrying each one's cells with it. */
export const reorderColumns = (
  table: ConceptTable,
  order: number[]
): ConceptTable => ({
  ...table,
  columns: order.flatMap((at) => table.columns[at] ?? []),
  rows: table.rows.map((row) => order.map((at) => row[at] ?? "")),
});

/** Sets an icon cell and keeps the icon's drawing with the table. */
export const setIconCell = (
  table: ConceptTable,
  rowIndex: number,
  columnIndex: number,
  name: string | null,
  svg: ConceptIconSvg | undefined
): ConceptTable => {
  const next = setCell(table, rowIndex, columnIndex, name ?? "");
  return name && svg
    ? { ...next, icons: { ...table.icons, [name]: svg } }
    : next;
};

export const setCellItemIcon = (
  table: ConceptTable,
  row: number,
  index: number,
  side: keyof CellIcons,
  name: string | null,
  svg?: ConceptIconSvg
): ConceptTable => {
  const column = table.columns[index];
  if (!(column && table.rows[row]) || column.kind === "icon") {
    return table;
  }
  const itemIcons = { ...column.itemIcons };
  const cell = { ...itemIcons[row] };
  if (name && svg) {
    cell[side] = name;
  } else {
    cell[side] = null;
  }
  if (Object.keys(cell).length) {
    itemIcons[row] = cell;
  } else {
    delete itemIcons[row];
  }
  const next = updateColumn(table, index, { itemIcons });
  return name && svg
    ? { ...next, icons: { ...table.icons, [name]: svg } }
    : next;
};

export const removeRow = (
  table: ConceptTable,
  index: number
): ConceptTable => ({
  ...table,
  columns: table.columns.map((column) => ({
    ...column,
    ...(column.itemIcons && { itemIcons: withoutRow(column.itemIcons, index) }),
    ...(column.cells && { cells: withoutRow(column.cells, index) }),
  })),
  rows: table.rows.filter((_, at) => at !== index),
});
