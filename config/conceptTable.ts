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
 *
 * Tables made before this stored only `options` (the column names) and drew
 * one row of "Example"; `tableOf` reads those the same way.
 */
export type ConceptCellKind = "text" | "stacked" | "tag" | "chips";

export interface ConceptTableColumn {
  /** Tag and chip colour, as hex. */
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

export interface ConceptTable {
  /** Absent on tables made before borders were settings: the default. */
  borders?: ConceptTableBorders;
  columns: ConceptTableColumn[];
  /** One string per column, in column order. */
  rows: string[][];
}

export const CELL_KINDS: readonly ConceptCellKind[] = [
  "text",
  "stacked",
  "tag",
  "chips",
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
const HEX_COLOR = /^#[\da-f]{3}(?:[\da-f]{3})?$/i;
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

const optionalColor = (value: unknown): { color?: string } =>
  typeof value === "string" && HEX_COLOR.test(value) ? { color: value } : {};

const cleanColumn = (value: unknown): ConceptTableColumn => {
  const raw = (value ?? {}) as Partial<ConceptTableColumn>;
  const kind = CELL_KINDS.includes(raw.kind as ConceptCellKind)
    ? (raw.kind as ConceptCellKind)
    : "text";
  return {
    ...optionalColor(raw.color),
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
    ...optionalColor(raw.color),
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
  return { ...(borders ? { borders } : {}), columns, rows };
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

export const removeRow = (
  table: ConceptTable,
  index: number
): ConceptTable => ({
  ...table,
  rows: table.rows.filter((_, at) => at !== index),
});
