import { useState } from "react";
import {
  DEFAULT_FRAME_GRID,
  type FrameGrid,
  gridCells,
  tracksOf,
  validTracks,
} from "../../../config/pageFrameGrid.js";
import { Input } from "../../components/ui/input";
import { PageField, PageNumber, PageSelect } from "./PageFields";

function Tracks({
  name,
  value,
  save,
}: {
  name: "Columns" | "Rows";
  value: string;
  save: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const valid = validTracks(draft, name === "Columns");
  return (
    <PageField label={name}>
      <Input
        aria-invalid={!valid}
        aria-label={name}
        onBlur={() => {
          if (valid) {
            save(draft.trim());
          }
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        size="sm"
        tone="board"
        value={draft}
      />
      {!valid && (
        <span>Use space-separated track sizes such as 1fr, 240px or auto.</span>
      )}
    </PageField>
  );
}

export function PageFrameGridFields({
  grid,
  save,
}: {
  grid?: FrameGrid;
  save: (grid: FrameGrid) => void;
}) {
  const current = grid ?? DEFAULT_FRAME_GRID;
  return (
    <>
      <PageSelect
        label="Frame layout"
        onChange={(mode) => save({ ...current, enabled: mode === "grid" })}
        options={[
          { label: "Free placement", value: "free" },
          { label: "Custom grid", value: "grid" },
        ]}
        value={grid?.enabled ? "grid" : "free"}
      />
      {grid?.enabled === true && (
        <>
          <Tracks
            key={grid.columns}
            name="Columns"
            save={(columns) => save({ ...grid, columns })}
            value={grid.columns}
          />
          <Tracks
            key={`rows-${grid.rows}`}
            name="Rows"
            save={(rows) => save({ ...grid, rows })}
            value={grid.rows}
          />
          <p>
            Use panel for a collapsible sidebar, 1fr for remaining space, or a
            size like 240px. Separate tracks with spaces.
          </p>
          <PageNumber
            label="Grid gap"
            max={256}
            onChange={(gap) => save({ ...grid, gap })}
            value={grid.gap}
          />
        </>
      )}
    </>
  );
}

export function PageGridPlacement({
  grid,
  id,
  elements,
  save,
}: {
  grid: FrameGrid;
  id: string;
  elements: { id: string }[];
  save: (grid: FrameGrid) => void;
}) {
  const cell = gridCells(grid, elements).get(id);
  if (!cell) {
    return null;
  }
  return (
    <div className="page-builder__numbers">
      {(["column", "row", "columnSpan", "rowSpan"] as const).map((key) => (
        <PageNumber
          key={key}
          label={
            {
              column: "Column",
              columnSpan: "Column span",
              row: "Row",
              rowSpan: "Row span",
            }[key]
          }
          max={key.startsWith("column") ? tracksOf(grid.columns).length : 256}
          min={1}
          onChange={(value) =>
            save({
              ...grid,
              cells: { ...grid.cells, [id]: { ...cell, [key]: value } },
            })
          }
          value={cell[key]}
        />
      ))}
    </div>
  );
}
