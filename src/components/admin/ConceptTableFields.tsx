import { Plus, Trash2 } from "lucide-react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  type ConceptIconSvg,
  conceptIconName,
} from "../../../config/conceptIcon.js";
import {
  CUSTOM_CELL_STYLE,
  cellLookOf,
  columnStyleOf,
} from "../../../config/conceptStyle.js";
import {
  addColumn,
  addRow,
  type ButtonStyle,
  COLUMN_WIDTH,
  type ConceptCellKind,
  type ConceptTable,
  type ConceptTableColumn,
  cellStyleKinds,
  DEFAULT_BORDERS,
  joinProgressCell,
  MAX_BORDER_WIDTH,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  progressLabelOf,
  removeColumn,
  removeRow,
  reorderColumns,
  setCell,
  setCellItemIcon,
  setColumnKind,
  setIconCell,
  type TableLines,
  tableOf,
  updateBorders,
  updateColumn,
  updateHeader,
} from "../../../config/conceptTable.js";
import {
  joinCardText,
  type ReviewConceptElement,
  splitCardText,
} from "../../../config/reviewConcept.js";
import { IconPicker } from "../../cms/IconPicker";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  ConceptField,
  ConceptGroup,
  ConceptSelect,
  NumberField,
  optionsOf,
} from "./ConceptControls";
import { ConceptTableCellStyleFields } from "./ConceptTableCellStyleFields";
import { ConceptColorField } from "./ReviewConceptBrand";
import { SortableList } from "./SortableList";

const KIND_OPTIONS = optionsOf([
  ["text", "Text"],
  ["stacked", "Two lines"],
  ["tag", "Tag"],
  ["chips", "Chips"],
  ["icon", "Icon"],
  ["button", "Button"],
  ["progress", "Progress"],
]);

const BUTTON_STYLES = optionsOf([
  ["solid", "Solid"],
  ["outline", "Outline"],
]);

const LINE_OPTIONS = optionsOf([
  ["none", "None"],
  ["rows", "Between rows"],
  ["grid", "Grid"],
]);

const TINTED = new Set<ConceptCellKind>([
  "tag",
  "chips",
  "icon",
  "button",
  "progress",
]);

/** One cell's editor, shaped by its column: two boxes for two lines. */
function CellInput({
  column,
  icons,
  label,
  onChange,
  onIcon,
  value,
}: {
  icons?: Record<string, ConceptIconSvg>;
  onIcon: (name: string | null, svg: ConceptIconSvg | undefined) => void;
  column: ConceptTableColumn;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  if (column.kind === "icon") {
    return (
      <IconPicker
        inline
        label={label}
        library="full"
        onChange={(name, svg) =>
          onIcon(name, svg as ConceptIconSvg | undefined)
        }
        size="sm"
        svg={icons?.[value]}
        value={conceptIconName(value)}
      />
    );
  }
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
  if (column.kind === "progress") {
    const [percent = ""] = value.split("\n");
    const line = progressLabelOf(value);
    return (
      <div className="review-concepts__table-stack">
        <Input
          aria-label={`${label}, percent`}
          face="numeric"
          max={100}
          min={0}
          onChange={(event) =>
            onChange(joinProgressCell(event.target.value, line))
          }
          size="sm"
          type="number"
          value={percent}
        />
        <Input
          aria-label={`${label}, description`}
          onChange={(event) =>
            onChange(joinProgressCell(percent, event.target.value))
          }
          placeholder="Description"
          size="sm"
          value={line}
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
 * A tinted column's look: a kit Badge or Button style its cells follow
 * (tags and chips take badges, buttons take buttons), or, while it follows
 * none, its own colour and a button column's solid or outline.
 */
function ColumnLook({
  brandDoc,
  column,
  index,
  onChange,
  textColor,
}: {
  brandDoc?: BrandKitDoc | null;
  column: ConceptTableColumn;
  index: number;
  onChange: (patch: Partial<ConceptTableColumn>) => void;
  textColor: string;
}) {
  const kinds = cellStyleKinds(column.kind);
  const styles = (brandDoc?.componentStyles ?? []).filter((style) =>
    kinds.includes(style.kind)
  );
  // A column that picked nothing follows the kit's first style of its kind.
  const linked = columnStyleOf(column, styles);
  return (
    <div className="review-concepts__table-tint">
      {styles.length > 0 ? (
        <ConceptField label="Kit style">
          <ConceptSelect
            label={`Column ${index + 1} kit style`}
            onChange={(id) =>
              onChange(
                id === CUSTOM_CELL_STYLE
                  ? {
                      look:
                        column.look ??
                        (linked ? cellLookOf(linked.look) : undefined),
                      styleId: CUSTOM_CELL_STYLE,
                    }
                  : { styleId: id }
              )
            }
            options={[
              { label: "Custom", value: CUSTOM_CELL_STYLE },
              ...styles.map((style) => ({
                label:
                  kinds.length > 1
                    ? `${style.kind === "tag" ? "Tag" : "Badge"} / ${style.name}`
                    : style.name,
                value: style.id,
              })),
            ]}
            value={linked?.id ?? CUSTOM_CELL_STYLE}
          />
        </ConceptField>
      ) : null}
      {linked ? (
        <p className="review-concepts__hint">
          Choose Custom to edit this column's items.
        </p>
      ) : null}
      {!linked && TINTED.has(column.kind) ? (
        <ConceptColorField
          ariaLabel={`Column ${index + 1} color`}
          brandDoc={brandDoc}
          label="Color"
          onChange={(color) =>
            onChange({
              color,
              ...(column.look?.color
                ? { look: { ...column.look, color } }
                : {}),
            })
          }
          value={column.color ?? textColor}
        />
      ) : null}
      {!linked && column.kind === "button" ? (
        <ConceptField label="Style">
          <ConceptSelect
            label={`Column ${index + 1} button style`}
            onChange={(style) =>
              onChange({ buttonStyle: style as ButtonStyle })
            }
            options={BUTTON_STYLES}
            value={column.buttonStyle ?? "solid"}
          />
        </ConceptField>
      ) : null}
      {linked ? null : (
        <ConceptTableCellStyleFields
          brandDoc={brandDoc}
          column={column}
          index={index}
          onChange={(look) => onChange({ look, styleId: CUSTOM_CELL_STYLE })}
          textColor={textColor}
        />
      )}
    </div>
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
  const set = (next: ConceptTable) => onChange({ table: next });
  return (
    <>
      <ConceptGroup name="Columns">
        <div className="review-concepts__table-editor">
          {/* Dragged by the handle, or moved with its arrow keys; a column's
              position is its id, so the ids are renumbered after each move. */}
          <SortableList
            itemLabel={({ column }) => `column ${column.label || "untitled"}`}
            items={table.columns.map((column, index) => ({
              column,
              id: String(index),
              index,
            }))}
            onReorder={(ids) => set(reorderColumns(table, ids.map(Number)))}
          >
            {({ column, index }, { handle }) => (
              <div className="review-concepts__table-column">
                {handle}
                <ConceptField label="Name">
                  <Input
                    aria-label={`Column ${index + 1} name`}
                    onChange={(event) =>
                      set(
                        updateColumn(table, index, {
                          label: event.target.value,
                        })
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
                {/* 0 is Auto: the column fits what is in it. */}
                <NumberField
                  label="Width"
                  max={COLUMN_WIDTH.max}
                  onChange={(width) =>
                    set(
                      updateColumn(table, index, {
                        width: width > 0 ? width : undefined,
                      })
                    )
                  }
                  value={column.width ?? 0}
                />
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
                <ColumnLook
                  brandDoc={brandDoc}
                  column={column}
                  index={index}
                  onChange={(patch) => set(updateColumn(table, index, patch))}
                  textColor={element.color}
                />
              </div>
            )}
          </SortableList>
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
          {table.rows.map((row, rowIndex) => (
            <div
              className="review-concepts__table-row"
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no ids
              key={rowIndex}
            >
              <div className="review-concepts__table-row-heading">
                <strong>Row {rowIndex + 1}</strong>
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
              <div className="review-concepts__table-cells">
                {table.columns.map((column, index) => {
                  const label = `Row ${rowIndex + 1}, ${column.label || `column ${index + 1}`}`;
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: table cells follow column order
                    <div className="review-concepts__table-cell" key={index}>
                      <span className="review-concepts__table-caption">
                        {column.label || `Column ${index + 1}`}
                      </span>
                      <CellInput
                        column={column}
                        icons={table.icons}
                        label={label}
                        onChange={(value) =>
                          set(setCell(table, rowIndex, index, value))
                        }
                        onIcon={(name, svg) =>
                          set(setIconCell(table, rowIndex, index, name, svg))
                        }
                        value={row[index] ?? ""}
                      />
                      {column.kind !== "icon" && (
                        <details className="review-concepts__table-icons">
                          <summary aria-label={`${label} icons`}>Icons</summary>
                          {(["start", "end"] as const).map((side) => {
                            const name = column.itemIcons?.[rowIndex]?.[side];
                            const position =
                              side === "start"
                                ? "Leading icon"
                                : "Trailing icon";
                            return (
                              <ConceptField key={side} label={position}>
                                <IconPicker
                                  inline
                                  label={`${label}, ${position}`}
                                  library="full"
                                  onChange={(icon, svg) =>
                                    set(
                                      setCellItemIcon(
                                        table,
                                        rowIndex,
                                        index,
                                        side,
                                        icon,
                                        svg as ConceptIconSvg | undefined
                                      )
                                    )
                                  }
                                  size="sm"
                                  svg={name ? table.icons?.[name] : undefined}
                                  value={name ?? null}
                                />
                              </ConceptField>
                            );
                          })}
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
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

      <ConceptGroup name="Header">
        <ConceptColorField
          allowNone
          ariaLabel="Table header background"
          brandDoc={brandDoc}
          label="Background"
          onChange={(background) => set(updateHeader(table, { background }))}
          value={table.header?.background ?? "transparent"}
        />
        <ConceptColorField
          allowNone
          ariaLabel="Table header text color"
          brandDoc={brandDoc}
          label="Text"
          onChange={(color) => set(updateHeader(table, { color }))}
          value={table.header?.color ?? "transparent"}
        />
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
      </ConceptGroup>
    </>
  );
}
