import { CONCEPT_HEX } from "./conceptColor.js";
import {
  type ConceptIconSvg,
  cleanIconSvg,
  conceptIconName,
} from "./conceptIcon.js";

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
  | "button";

export type ButtonStyle = "solid" | "outline";

export interface ConceptTableColumn {
  /** Button columns: filled with the colour, or outlined in it. */
  buttonStyle?: ButtonStyle;
  /** Tag, chip, icon and button colour, as hex. */
  color?: string;
  kind: ConceptCellKind;
  label: string;
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
  typeof value === "string" && CONCEPT_HEX.test(value)
    ? ({ [key]: value } as Record<K, string>)
    : {};

const cleanColumn = (value: unknown): ConceptTableColumn => {
  const raw = (value ?? {}) as Partial<ConceptTableColumn>;
  const kind = CELL_KINDS.includes(raw.kind as ConceptCellKind)
    ? (raw.kind as ConceptCellKind)
    : "text";
  return {
    ...(kind === "button" && raw.buttonStyle === "outline"
      ? { buttonStyle: "outline" as const }
      : {}),
    ...optionalHex("color", raw.color),
    kind,
    label: text(raw.label, MAX_LABEL),
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
  const columns = (Array.isArray(raw.columns) ? raw.columns : [])
    .slice(0, MAX_TABLE_COLUMNS)
    .map(cleanColumn);
  if (columns.length === 0) {
    return undefined;
  }
  const rows = (Array.isArray(raw.rows) ? raw.rows : [])
    .slice(0, MAX_TABLE_ROWS)
    .map((row) =>
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
  const iconColumns = [...columns.keys()].filter(
    (index) => columns[index]?.kind === "icon"
  );
  const icons: Record<string, ConceptIconSvg> = {};
  for (const row of rows) {
    for (const index of iconColumns) {
      const name = conceptIconName(row[index]);
      const svg = name ? cleanIconSvg(raw[name]) : undefined;
      if (name && svg) {
        icons[name] = svg;
      }
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
  const retyped = updateColumn(table, index, { kind });
  return kind === "stacked"
    ? retyped
    : {
        ...retyped,
        rows: retyped.rows.map((row) =>
          row.map((cell, at) =>
            at === index ? cell.replace(LINE_BREAKS, " ") : cell
          )
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

export const removeRow = (
  table: ConceptTable,
  index: number
): ConceptTable => ({
  ...table,
  rows: table.rows.filter((_, at) => at !== index),
});
