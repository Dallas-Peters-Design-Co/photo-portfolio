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
import { ProgressBar } from "./ConceptProgressPreview";
import "./ConceptTablePreview.css";

const ICON_SUFFIX = /Icon$/;

/** Lines with no colour of their own: a faint tint of the text colour. */
const DEFAULT_LINE = "color-mix(in srgb, currentColor 14%, transparent)";

/** A tinted column's colour (tag, chips, icon, button): its own, or the text's. */
const tintOf = (column: ConceptTableColumn): string =>
  column.look?.color ?? column.color ?? "currentColor";

const tint = (column: ConceptTableColumn): CSSProperties =>
  ({ "--concept-tint": tintOf(column) }) as CSSProperties;

/**
 * A cell drawn as its column's kit style draws: the badge's or button's own
 * fill, border, corners, padding, type and shadow, over the tinted default.
 */
const lookStyle = (look?: ConceptCellLook): CSSProperties =>
  look
    ? {
        background: look.background,
        border: look.borderColor
          ? `${look.borderWidth ?? 1}px solid ${look.borderColor}`
          : undefined,
        borderRadius: look.radius,
        boxShadow: look.shadow ? shadowCss(look.shadow) : undefined,
        color: look.color,
        fontSize: look.fontSize,
        fontWeight: look.fontWeight,
        padding:
          look.paddingY === undefined || look.paddingX === undefined
            ? undefined
            : `${look.paddingY}px ${look.paddingX}px`,
      }
    : {};

/** A tag or button: its column's tint, and its kit style when it has one. */
const pill = (column: ConceptTableColumn): CSSProperties => ({
  ...tint(column),
  ...lookStyle(column.look),
});

function Cell({
  column,
  icons,
  value,
}: {
  column: ConceptTableColumn;
  icons?: Record<string, ConceptIconSvg>;
  value: string;
}) {
  switch (column.kind) {
    case "stacked": {
      const { body, title } = splitCardText(value);
      return (
        <span className="concept-table__stack">
          <span>{title}</span>
          {body ? <small>{body}</small> : null}
        </span>
      );
    }
    case "tag":
      return value ? (
        <span className="concept-table__tag" style={pill(column)}>
          {value}
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
              {chip}
            </span>
          ))}
        </span>
      );
    case "icon": {
      const svg = icons?.[value];
      return svg ? (
        <HugeiconsIcon
          aria-label={value.replace(ICON_SUFFIX, "")}
          className="concept-table__icon"
          color={tintOf(column)}
          icon={svg}
          role="img"
          size="1.25em"
          strokeWidth={2}
        />
      ) : null;
    }
    case "button":
      return value ? (
        <span
          className="concept-table__button"
          data-style={column.buttonStyle ?? "solid"}
          style={pill(column)}
        >
          {value}
        </span>
      ) : null;
    case "progress": {
      const percent = progressOf(value);
      const label = progressLabelOf(value);
      // The description and the percent head the bar: the text at the
      // start, the percent at the end.
      return (
        <span className="concept-table__progress">
          <span className="concept-table__progress-head">
            <span>{label}</span>
            <small>{Math.round(percent)}%</small>
          </span>
          <ProgressBar
            color={tintOf(column)}
            height={6}
            label={label || `${Math.round(percent)}%`}
            radius={999}
            track="color-mix(in srgb, currentColor 12%, transparent)"
            value={percent}
          />
        </span>
      );
    }
    default:
      return <>{value}</>;
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
  return (
    <table
      className="concept-table"
      data-lines={borders.lines}
      data-outline={borders.outline || undefined}
      style={lineStyle}
    >
      <thead style={headerStyle}>
        <tr>
          {columns.map((column, index) => (
            // Labels can repeat, so position is the identity of a column.
            // biome-ignore lint/suspicious/noArrayIndexKey: columns have no ids
            <th key={index}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no ids
          <tr key={rowIndex}>
            {columns.map((column, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: as above
              <td key={index}>
                <Cell column={column} icons={icons} value={row[index] ?? ""} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
