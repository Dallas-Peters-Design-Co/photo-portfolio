import { Plus, Trash2 } from "lucide-react";
import { type CSSProperties, useId } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  addColumn,
  addRow,
  type ConceptCellKind,
  type ConceptTable,
  type ConceptTableColumn,
  DEFAULT_BORDERS,
  MAX_BORDER_WIDTH,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  removeColumn,
  removeRow,
  setCell,
  setColumnKind,
  type TableLines,
  tableOf,
  updateBorders,
  updateColumn,
} from "../../../config/conceptTable.js";
import {
  joinCardText,
  type ReviewConceptElement,
  splitCardText,
} from "../../../config/reviewConcept.js";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import {
  ConceptField,
  ConceptGroup,
  ConceptSelect,
  NumberField,
  optionsOf,
} from "./ConceptControls";
import { ConceptColorField } from "./ReviewConceptBrand";

const KIND_OPTIONS = optionsOf([
  ["text", "Text"],
  ["stacked", "Two lines"],
  ["tag", "Tag"],
  ["chips", "Chips"],
]);

const LINE_OPTIONS = optionsOf([
  ["none", "None"],
  ["rows", "Between rows"],
  ["grid", "Grid"],
]);

const TINTED = new Set<ConceptCellKind>(["tag", "chips"]);

/** One cell's editor, shaped by its column: two boxes for two lines. */
function CellInput({
  column,
  label,
  onChange,
  value,
}: {
  column: ConceptTableColumn;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  if (column.kind === "stacked") {
    const { body, title } = splitCardText(value);
    return (
      <div className="review-concepts__table-stack">
        <Input
          aria-label={`${label}, main line`}
          onChange={(event) => onChange(joinCardText(event.target.value, body))}
          size="sm"
          value={title}
        />
        <Input
          aria-label={`${label}, second line`}
          onChange={(event) =>
            onChange(joinCardText(title, event.target.value))
          }
          placeholder="Second line"
          size="sm"
          value={body}
        />
      </div>
    );
  }
  return (
    <Input
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      placeholder={column.kind === "chips" ? "One, two" : undefined}
      size="sm"
      value={value}
    />
  );
}

/**
 * A table's columns (name, type, colour) and its rows, cell by cell. Every
 * edit goes through the pure functions in conceptTable.ts.
 */
export function ConceptTableFields({
  brandDoc,
  element,
  onChange,
}: {
  brandDoc?: BrandKitDoc | null;
  element: ReviewConceptElement;
  onChange: (patch: Partial<ReviewConceptElement>) => void;
}) {
  const table = tableOf(element);
  const borders = table.borders ?? DEFAULT_BORDERS;
  const outlineId = useId();
  const set = (next: ConceptTable) => onChange({ table: next });
  const gridStyle = {
    "--table-columns": table.columns.length,
  } as CSSProperties;

  return (
    <>
      <ConceptGroup name="Columns">
        <div className="review-concepts__table-editor">
          {table.columns.map((column, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: columns have no ids
            <div className="review-concepts__table-column" key={index}>
              <ConceptField label="Name">
                <Input
                  aria-label={`Column ${index + 1} name`}
                  onChange={(event) =>
                    set(
                      updateColumn(table, index, { label: event.target.value })
                    )
                  }
                  size="sm"
                  value={column.label}
                />
              </ConceptField>
              <ConceptField label="Cells">
                <ConceptSelect
                  label={`Column ${index + 1} cells`}
                  onChange={(kind) =>
                    set(setColumnKind(table, index, kind as ConceptCellKind))
                  }
                  options={KIND_OPTIONS}
                  value={column.kind}
                />
              </ConceptField>
              {TINTED.has(column.kind) ? (
                <ConceptColorField
                  ariaLabel={`Column ${index + 1} color`}
                  brandDoc={brandDoc}
                  label="Color"
                  onChange={(color) =>
                    set(updateColumn(table, index, { color }))
                  }
                  value={column.color ?? element.color}
                />
              ) : (
                <span />
              )}
              <Button
                aria-label={`Remove column ${index + 1}`}
                disabled={table.columns.length <= 1}
                onClick={() => set(removeColumn(table, index))}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
          <div>
            <Button
              disabled={table.columns.length >= MAX_TABLE_COLUMNS}
              onClick={() => set(addColumn(table))}
              size="xs"
              type="button"
              variant="outline"
            >
              <Plus size={13} /> Add column
            </Button>
          </div>
        </div>
      </ConceptGroup>

      <ConceptGroup name="Rows">
        <div className="review-concepts__table-editor">
          <div className="review-concepts__table-row" style={gridStyle}>
            {table.columns.map((column, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: as above
              <span className="review-concepts__table-head" key={index}>
                {column.label}
              </span>
            ))}
            <span />
          </div>
          {table.rows.map((row, rowIndex) => (
            <div
              className="review-concepts__table-row"
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no ids
              key={rowIndex}
              style={gridStyle}
            >
              {table.columns.map((column, index) => (
                <CellInput
                  column={column}
                  // biome-ignore lint/suspicious/noArrayIndexKey: as above
                  key={index}
                  label={`Row ${rowIndex + 1}, ${column.label || `column ${index + 1}`}`}
                  onChange={(value) =>
                    set(setCell(table, rowIndex, index, value))
                  }
                  value={row[index] ?? ""}
                />
              ))}
              <Button
                aria-label={`Remove row ${rowIndex + 1}`}
                onClick={() => set(removeRow(table, rowIndex))}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
          <div>
            <Button
              disabled={table.rows.length >= MAX_TABLE_ROWS}
              onClick={() => set(addRow(table))}
              size="xs"
              type="button"
              variant="outline"
            >
              <Plus size={13} /> Add row
            </Button>
          </div>
        </div>
      </ConceptGroup>

      <ConceptGroup name="Borders">
        <ConceptField label="Lines">
          <ConceptSelect
            label="Table lines"
            onChange={(lines) =>
              set(updateBorders(table, { lines: lines as TableLines }))
            }
            options={LINE_OPTIONS}
            value={borders.lines}
          />
        </ConceptField>
        <NumberField
          label="Width"
          max={MAX_BORDER_WIDTH}
          min={1}
          onChange={(width) => set(updateBorders(table, { width }))}
          value={borders.width}
        />
        <ConceptColorField
          ariaLabel="Table line color"
          brandDoc={brandDoc}
          label="Color"
          onChange={(color) => set(updateBorders(table, { color }))}
          value={borders.color ?? "#d0d5dd"}
        />
        <label className="review-concepts__check" htmlFor={outlineId}>
          <Checkbox
            checked={borders.outline}
            id={outlineId}
            onChange={(event) =>
              set(updateBorders(table, { outline: event.target.checked }))
            }
          />
          <span>Outline</span>
        </label>
      </ConceptGroup>
    </>
  );
}
