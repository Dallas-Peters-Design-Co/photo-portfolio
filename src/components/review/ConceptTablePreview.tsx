import { HugeiconsIcon } from "@hugeicons/react";
import type { CSSProperties } from "react";
import type { ConceptIconSvg } from "../../../config/conceptIcon.js";
import { shadowCss } from "../../../config/conceptShadow.js";
import {
  type ConceptCellLook,
  type ConceptTableColumn,
  chipsOf,
  DEFAULT_BORDERS,
  progressLabelOf,
  progressOf,
  tableOf,
} from "../../../config/conceptTable.js";
import {
  type ReviewConceptElement,
  splitCardText,
} from "../../../config/reviewConcept.js";
import {
  cellColumn,
  progressCellBar,
} from "../../../config/tableCellStyles.js";
import { tableItemIcon } from "../../../config/tableItemIcons.js";
import { ConceptIcon } from "./ConceptIcon";
import { ProgressIndicator } from "./ConceptProgressPreview";
import "./ConceptTablePreview.css";

const ICON_SUFFIX = /Icon$/;

/** Lines with no colour of their own: a faint tint of the text colour. */
const DEFAULT_LINE = "color-mix(in srgb, currentColor 14%, transparent)";

/** A tinted column's colour (tag, chips, icon, button): its own, or the text's. */
const tintOf = (column: ConceptTableColumn): string =>
  column.look?.color ?? column.color ?? "currentColor";

const tint = (column: ConceptTableColumn): CSSProperties =>
  ({ "--concept-tint": tintOf(column) }) as CSSProperties;

const lookBorder = (look: ConceptCellLook): string | undefined => {
  if (look.borderColor) {
    return `${look.borderWidth ?? 1}px solid ${look.borderColor}`;
  }
  return look.borderWidth === 0 ? "none" : undefined;
};

/**
 * A cell drawn as its column's kit style draws: the badge's or button's own
 * fill, border, corners, padding, type and shadow, over the tinted default.
 */
const lookStyle = (look?: ConceptCellLook): CSSProperties =>
  look
    ? {
        background: look.background,
        // A kit style with no border colour draws none, as the kit does:
        // the cell's own 1px outline made its buttons 2px taller.
        border: lookBorder(look),
        borderRadius: look.radius,
        boxShadow: look.shadow ? shadowCss(look.shadow) : undefined,
        color: look.color,
        fontSize: look.fontSize,
        fontWeight: look.fontWeight,
        lineHeight: look.lineHeight,
        paddingBlock: look.paddingY,
        paddingInline: look.paddingX,
        textAlign: look.textAlign,
      }
    : {};

/** A tag or button: its column's tint, and its kit style when it has one. */
const pill = (column: ConceptTableColumn): CSSProperties => ({
  ...tint(column),
  ...lookStyle(column.look),
});

function Cell({
  column,
  icons = {},
  row,
  value,
}: {
  column: ConceptTableColumn;
  icons?: Record<string, ConceptIconSvg>;
  row: number;
  value: string;
}) {
  const start = tableItemIcon(column, row, "start", icons);
  const end = tableItemIcon(column, row, "end", icons);
  const size = column.look?.iconSize ?? "1em";
  const label = (text: string) =>
    start || end ? (
      <span className="concept-table__item-label">
        {start ? (
          <ConceptIcon {...start} color={column.look?.iconColor} size={size} />
        ) : null}
        {text}
        {end ? (
          <ConceptIcon {...end} color={column.look?.iconColor} size={size} />
        ) : null}
      </span>
    ) : (
      text
    );
  switch (column.kind) {
    case "stacked": {
      const { body, title } = splitCardText(value);
      return (
        <span className="concept-table__stack">
          <span>{label(title)}</span>
          {body ? <small>{body}</small> : null}
        </span>
      );
    }
    case "tag":
      return value ? (
        <span className="concept-table__tag" style={pill(column)}>
          {label(value)}
        </span>
      ) : null;
    case "chips":
      return (
        // The tint is inherited, so it is set once on the group.
        <span className="concept-table__chips" style={tint(column)}>
          {chipsOf(value).map((chip, index) => (
            <span
              className="concept-table__chip"
              // biome-ignore lint/suspicious/noArrayIndexKey: chips can repeat
              key={`${index}-${chip}`}
              style={lookStyle(column.look)}
            >
              {label(chip)}
            </span>
          ))}
        </span>
      );
    case "icon": {
      const svg = icons[value];
      return svg ? (
        <HugeiconsIcon
          aria-label={value.replace(ICON_SUFFIX, "")}
          className="concept-table__icon"
          color={tintOf(column)}
          icon={svg}
          role="img"
          size={column.look?.fontSize ?? "1.25em"}
          strokeWidth={2}
        />
      ) : null;
    }
    case "button":
      return value || start || end ? (
        <span
          className="concept-table__button"
          data-style={column.buttonStyle ?? "solid"}
          style={pill(column)}
        >
          {!value && (
            <span className="sr-only">{column.label || "Action"}</span>
          )}
          {label(value)}
        </span>
      ) : null;
    case "progress": {
      const percent = progressOf(value);
      const description = progressLabelOf(value);
      return (
        <ProgressIndicator
          bar={{
            ...progressCellBar(column),
            label: description || `${Math.round(percent)}%`,
            value: percent,
          }}
          label={label(description)}
          showValue={column.look?.showValue !== false}
          style={lookStyle(column.look)}
          table
        />
      );
    }
    default:
      return <>{label(value)}</>;
  }
}

export function ConceptTablePreview({
  element,
  style,
}: {
  element: ReviewConceptElement;
  style: CSSProperties;
}) {
  const {
    borders = DEFAULT_BORDERS,
    columns,
    header,
    icons,
    rows,
  } = tableOf(element);
  const headerStyle = {
    "--concept-head-ink": header?.color,
    background: header?.background,
  } as CSSProperties;
  const lineStyle = {
    ...style,
    "--concept-line": borders.color ?? DEFAULT_LINE,
    "--concept-line-width": `${borders.width}px`,
    // The cells carry the spacing; the table's own padding would set the
    // lines in from the outline.
    padding: 0,
  } as CSSProperties;
  // The box (fill, border, corners, shadow) is the scroller's, so a table
  // wider than its space scrolls sideways inside it instead of being cut off.
  return (
    <div className="concept-table-scroll" style={lineStyle}>
      <table
        className="concept-table"
        data-lines={borders.lines}
        data-outline={borders.outline || undefined}
      >
        <thead style={headerStyle}>
          <tr>
            {columns.map((column, index) => (
              // Labels can repeat, so position is the identity of a column.
              <th
                // biome-ignore lint/suspicious/noArrayIndexKey: columns have no ids
                key={index}
                style={
                  column.width
                    ? { minWidth: column.width, width: column.width }
                    : undefined
                }
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no ids
            <tr key={rowIndex}>
              {columns.map((source, index) => {
                const column = cellColumn(source, rowIndex);
                const box = source.cells?.[rowIndex]?.box;
                const textCell =
                  column.kind === "text" || column.kind === "stacked";
                return (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: columns have no ids
                    key={index}
                    style={{
                      ...lookStyle(textCell ? { ...column.look, ...box } : box),
                      textAlign: column.look?.textAlign,
                    }}
                  >
                    <Cell
                      column={column}
                      icons={icons}
                      row={rowIndex}
                      value={row[index] ?? ""}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
