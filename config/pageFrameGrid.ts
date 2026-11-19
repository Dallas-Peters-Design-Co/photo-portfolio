export interface GridCell {
  column: number;
  columnSpan: number;
  row: number;
  rowSpan: number;
}
export interface FrameGrid {
  cells: Record<string, GridCell>;
  columns: string;
  enabled: boolean;
  gap: number;
  rows: string;
}

export const DEFAULT_FRAME_GRID: FrameGrid = {
  cells: {},
  columns: "panel 1fr panel",
  enabled: true,
  gap: 0,
  rows: "auto",
};

const SPACE = /\s+/;
export const tracksOf = (value: string) => value.trim().split(SPACE);
const TRACK = /^(?:auto|(?:\d{1,4}(?:\.\d{1,2})?)(?:fr|px|%))$/;
export function validTracks(value: unknown, columns: boolean): value is string {
  if (typeof value !== "string" || value.length > 256) {
    return false;
  }
  const tracks = tracksOf(value);
  return (
    tracks.length <= 24 &&
    tracks.every((track) => TRACK.test(track) || (columns && track === "panel"))
  );
}
const integer = (n: unknown, fallback: number, max: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.max(1, Math.min(max, Math.round(n)))
    : fallback;

export function cleanFrameGrid(
  value: Partial<FrameGrid> | undefined,
  ids: Set<string>
): FrameGrid | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const cells: Record<string, GridCell> = {};
  for (const id of ids) {
    const cell = value.cells?.[id];
    if (cell && typeof cell === "object") {
      cells[id] = {
        column: integer(cell.column, 1, 24),
        columnSpan: integer(cell.columnSpan, 1, 24),
        row: integer(cell.row, 1, 256),
        rowSpan: integer(cell.rowSpan, 1, 256),
      };
    }
  }
  return {
    cells,
    columns: validTracks(value.columns, true)
      ? value.columns.trim()
      : DEFAULT_FRAME_GRID.columns,
    enabled: value.enabled !== false,
    gap:
      typeof value.gap === "number" && Number.isFinite(value.gap)
        ? Math.max(0, Math.min(256, value.gap))
        : 0,
    rows: validTracks(value.rows, false)
      ? value.rows.trim()
      : DEFAULT_FRAME_GRID.rows,
  };
}

export function gridCells(grid: FrameGrid, elements: { id: string }[]) {
  const count = tracksOf(grid.columns).length;
  const cells = new Map<string, GridCell>();
  const reserved: GridCell[] = [];
  for (const { id } of elements) {
    const cell = grid.cells[id];
    if (!cell) {
      continue;
    }
    const column = Math.min(count, cell.column);
    const placed = {
      ...cell,
      column,
      columnSpan: Math.min(count - column + 1, cell.columnSpan),
    };
    reserved.push(placed);
    cells.set(id, placed);
  }
  let index = 0;
  for (const { id } of elements) {
    if (cells.has(id)) {
      continue;
    }
    while (!cells.has(id)) {
      const column = (index % count) + 1;
      const row = Math.floor(index / count) + 1;
      index += 1;
      if (
        !reserved.some(
          (c) =>
            column >= c.column &&
            column < c.column + c.columnSpan &&
            row >= c.row &&
            row < c.row + c.rowSpan
        )
      ) {
        cells.set(id, { column, columnSpan: 1, row, rowSpan: 1 });
      }
    }
  }
  return cells;
}
export function trackCss(value: string) {
  return tracksOf(value)
    .map((track) => {
      if (track === "panel") {
        return "max-content";
      }
      return track.endsWith("fr") ? `minmax(0, ${track})` : track;
    })
    .join(" ");
}
