import { escapeJsx, type Markup } from "./componentSourceParts.js";
import { shadowCss } from "./conceptShadow.js";
import {
  type ConceptCellLook,
  type ConceptTableColumn,
  chipsOf,
  DEFAULT_BORDERS,
  progressLabelOf,
  progressOf,
  tableOf,
} from "./conceptTable.js";
import { type ReviewConceptElement, splitCardText } from "./reviewConcept.js";

/**
 * A table for componentSource, drawn as the app draws one
 * (src/components/review/ConceptTablePreview): each column's cells by their
 * type — tags, chips, buttons, two-line text, progress — in the column's
 * colour, or in the brand kit badge or button style the column follows.
 *
 * In a body `@@` stands for the block's class; in CSS `&` does.
 */

/** Rows a copied table carries as its sample. */
const SAMPLE_ROWS = 3;

const DEFAULT_LINE = "color-mix(in srgb, currentColor 14%, transparent)";

const tintOf = (column: ConceptTableColumn): string =>
  column.look?.color ?? column.color ?? "currentColor";

/** A kit style's look on a tag, chip or button: only what it sets. */
const lookCss = (look: ConceptCellLook): string =>
  [
    look.background && `background: ${look.background};`,
    look.borderColor &&
      `border: ${look.borderWidth ?? 1}px solid ${look.borderColor};`,
    look.radius !== undefined && `border-radius: ${look.radius}px;`,
    look.shadow && `box-shadow: ${shadowCss(look.shadow)};`,
    look.color && `color: ${look.color};`,
    look.fontSize !== undefined && `font-size: ${look.fontSize}px;`,
    look.fontWeight !== undefined && `font-weight: ${look.fontWeight};`,
    look.paddingY !== undefined &&
      look.paddingX !== undefined &&
      `padding: ${look.paddingY}px ${look.paddingX}px;`,
  ]
    .filter(Boolean)
    .join(" ");

const cellOf = (column: ConceptTableColumn, value: string): string => {
  switch (column.kind) {
    case "stacked": {
      const { body, title } = splitCardText(value);
      return `<span className="@@__stack"><span>${escapeJsx(title)}</span>${body ? `<small>${escapeJsx(body)}</small>` : ""}</span>`;
    }
    case "tag":
      return value
        ? `<span className="@@__tag">${escapeJsx(value)}</span>`
        : "";
    case "chips":
      return `<span className="@@__chips">${chipsOf(value)
        .map((chip) => `<span className="@@__chip">${escapeJsx(chip)}</span>`)
        .join("")}</span>`;
    case "button":
      return value
        ? `<button className="@@__button" type="button" data-style="${column.buttonStyle ?? "solid"}">${escapeJsx(value)}</button>`
        : "";
    case "progress": {
      const percent = Math.round(progressOf(value));
      const label = progressLabelOf(value);
      return `<span className="@@__progress"><span className="@@__progress-head"><span>${escapeJsx(label)}</span><small>${percent}%</small></span><span className="@@__bar" role="progressbar" aria-label=${JSON.stringify(label || `${percent}%`)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={${percent}}><span style={{ inlineSize: "${percent}%" }} /></span></span>`;
    }
    default:
      return escapeJsx(value);
  }
};

/** The app's table CSS, under the block's class. */
const TABLE_CSS = `& { width: 100%; border-spacing: 0; border-collapse: separate; padding: 0; }
& th, & td { padding: 8px 12px; vertical-align: middle; text-align: start; }
& th { font-size: 0.85em; font-weight: 600; color: var(--&-head-color, color-mix(in srgb, currentColor 65%, transparent)); }
& thead { background: var(--&-head-background, transparent); }
&__stack { display: grid; gap: 0.15em; }
&__stack > small { font-size: 0.85em; color: color-mix(in srgb, currentColor 60%, transparent); }
&__tag, &__chip { display: inline-flex; align-items: center; padding: 0.15em 0.6em; font-size: 0.8em; font-weight: 600; line-height: 1.4; color: var(--&-tint); white-space: nowrap; border-radius: 999px; }
&__tag { background: color-mix(in srgb, var(--&-tint) 16%, transparent); }
&__chip { border: 1px solid color-mix(in srgb, var(--&-tint) 40%, transparent); }
&__chips { display: inline-flex; flex-wrap: wrap; gap: 0.35em; }
&__button { display: inline-flex; align-items: center; padding: 0.35em 0.9em; font: inherit; font-size: 0.85em; font-weight: 600; line-height: 1.3; white-space: nowrap; cursor: pointer; border: 1px solid var(--&-tint); border-radius: 0.4em; }
&__button[data-style="solid"] { color: #fff; background: var(--&-tint); }
&__button[data-style="outline"] { color: var(--&-tint); background: transparent; }
&__progress { display: flex; flex-direction: column; gap: 0.35em; min-inline-size: 6rem; }
&__progress small { font-variant-numeric: tabular-nums; opacity: 0.7; }
&__progress-head { display: flex; gap: 0.5em; align-items: baseline; justify-content: space-between; }
&__bar { display: block; block-size: 6px; overflow: hidden; background: color-mix(in srgb, currentColor 12%, transparent); border-radius: 999px; }
&__bar > span { display: block; block-size: 100%; background: var(--&-tint); border-radius: inherit; }`;

/** Lines between rows, around every cell, or none; and the outline. */
const linesCss = (el: ReviewConceptElement): string => {
  const borders = tableOf(el).borders ?? DEFAULT_BORDERS;
  const line = `${borders.width}px solid ${borders.color ?? DEFAULT_LINE}`;
  const rules: string[] = [];
  if (borders.lines === "rows") {
    rules.push(`& th, & td { border-bottom: ${line}; }`);
  } else if (borders.lines === "grid") {
    rules.push(
      `& th, & td { border-block-end: ${line}; border-inline-end: ${line}; }`,
      `& th:first-child, & td:first-child { border-inline-start: ${line}; }`,
      `& thead th { border-block-start: ${line}; }`
    );
  }
  if (borders.outline) {
    rules.push(`& { outline: ${line}; outline-offset: -${borders.width}px; }`);
  }
  return rules.join("\n");
};

/** Each tinted column's colour, and its kit style's look on its cells. */
const columnsCss = (columns: ConceptTableColumn[]): string =>
  columns
    .flatMap((column, index) => {
      const cell = `& td:nth-child(${index + 1})`;
      const rules = [`${cell} { --&-tint: ${tintOf(column)}; }`];
      const look = column.look ? lookCss(column.look) : "";
      if (look) {
        rules.push(`${cell} :is(&__tag, &__chip, &__button) { ${look} }`);
      }
      return column.kind === "text" || column.kind === "stacked" ? [] : rules;
    })
    .join("\n");

export const tableMarkup = (el: ReviewConceptElement): Markup => {
  const table = tableOf(el);
  const head = table.columns
    .map((column) => `    <th scope="col">${escapeJsx(column.label)}</th>`)
    .join("\n");
  const rows = table.rows
    .slice(0, SAMPLE_ROWS)
    .map(
      (row) =>
        `  <tr>\n${table.columns
          .map((column, i) => `    <td>${cellOf(column, row[i] ?? "")}</td>`)
          .join("\n")}\n  </tr>`
    )
    .join("\n");
  return {
    body: `<thead>\n  <tr>\n${head}\n  </tr>\n</thead>\n<tbody>\n${rows}\n</tbody>`,
    css: [TABLE_CSS, linesCss(el), columnsCss(table.columns)]
      .filter(Boolean)
      .join("\n"),
    tag: "table",
    tokens: [
      ["padding", "0"],
      ...(table.header?.background
        ? ([["head-background", table.header.background]] as [string, string][])
        : []),
      ...(table.header?.color
        ? ([["head-color", table.header.color]] as [string, string][])
        : []),
    ],
  };
};
