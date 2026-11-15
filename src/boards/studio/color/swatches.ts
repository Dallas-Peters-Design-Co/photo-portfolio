import { esc, svgDoc } from "../rng";
import { inkOn } from "./harmony";

/**
 * Rows of colour chips with their hex values, as an SVG for the board: a
 * palette is one row, a set of ramps is one row per ramp.
 */

export interface SwatchRow {
  colors: string[];
  label?: string;
  /** A caption per chip, under its hex (e.g. 500). */
  steps?: (number | string)[];
}

const CHIP = 120;
const LABEL = 180;
const GAP = 8;
const PAD = 40;

/** One board-ready swatch. Kept separate from the palette sheet. */
export const colorSwatchSvg = (color: string): string => {
  const ink = inkOn(color);
  return svgDoc(
    480,
    360,
    `<rect width="480" height="360" fill="${color}"/><text x="240" y="190" text-anchor="middle" dominant-baseline="middle" fill="${ink}" font-family="system-ui,sans-serif" font-size="32" font-weight="600">${esc(color.toUpperCase())}</text>`
  );
};

export const swatchesSvg = (
  rows: SwatchRow[]
): { h: number; svg: string; w: number } => {
  const labelled = rows.some((r) => r.label);
  const cols = Math.max(1, ...rows.map((r) => r.colors.length));
  const left = PAD + (labelled ? LABEL : 0);
  const w = left + cols * (CHIP + GAP) - GAP + PAD;
  const h = PAD * 2 + rows.length * (CHIP + GAP) - GAP;
  const body = rows
    .map((row, ri) => {
      const y = PAD + ri * (CHIP + GAP);
      const label = row.label
        ? `<text x="${PAD}" y="${y + CHIP / 2 + 6}" font-size="18" font-weight="600" fill="#111">${esc(row.label)}</text>`
        : "";
      const chips = row.colors
        .map((c, ci) => {
          const x = left + ci * (CHIP + GAP);
          const ink = inkOn(c);
          const step = row.steps?.[ci];
          return `<rect x="${x}" y="${y}" width="${CHIP}" height="${CHIP}" rx="10" fill="${c}"/><text x="${x + 12}" y="${y + CHIP - 14}" font-size="14" fill="${ink}" font-family="ui-monospace,monospace">${c.toUpperCase()}</text>${step === undefined ? "" : `<text x="${x + 12}" y="${y + 26}" font-size="14" font-weight="600" fill="${ink}">${step}</text>`}`;
        })
        .join("");
      return label + chips;
    })
    .join("");
  return {
    h,
    svg: svgDoc(
      w,
      h,
      `<rect width="${w}" height="${h}" fill="#ffffff"/><g font-family="Inter,system-ui,sans-serif">${body}</g>`
    ),
    w,
  };
};
