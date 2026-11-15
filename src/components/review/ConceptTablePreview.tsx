import type { CSSProperties } from "react";
import {
  type ConceptTableColumn,
  chipsOf,
  DEFAULT_BORDERS,
  tableOf,
} from "../../../config/conceptTable.js";
import {
  type ReviewConceptElement,
  splitCardText,
} from "../../../config/reviewConcept.js";
import "./ConceptTablePreview.css";

/** Lines with no colour of their own: a faint tint of the text colour. */
const DEFAULT_LINE = "color-mix(in srgb, currentColor 14%, transparent)";

/** Tag and chip colour: the column's own, or the text colour. */
const tint = (column: ConceptTableColumn): CSSProperties =>
  ({ "--concept-tint": column.color ?? "currentColor" }) as CSSProperties;

function Cell({
  column,
  value,
}: {
  column: ConceptTableColumn;
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
        <span className="concept-table__tag" style={tint(column)}>
          {value}
        </span>
      ) : null;
    case "chips":
      return (
        // The tint is inherited, so it is set once on the group.
        <span className="concept-table__chips" style={tint(column)}>
          {chipsOf(value).map((chip, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: chips can repeat
            <span className="concept-table__chip" key={`${index}-${chip}`}>
              {chip}
            </span>
          ))}
        </span>
      );
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
  const { borders = DEFAULT_BORDERS, columns, rows } = tableOf(element);
  const lineStyle = {
    ...style,
    "--concept-line": borders.color ?? DEFAULT_LINE,
    "--concept-line-width": `${borders.width}px`,
  } as CSSProperties;
  return (
    <table
      className="concept-table"
      data-lines={borders.lines}
      data-outline={borders.outline || undefined}
      style={lineStyle}
    >
      <thead>
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
                <Cell column={column} value={row[index] ?? ""} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
