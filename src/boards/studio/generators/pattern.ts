import { esc, r2, svgDoc } from "../rng";
import type { ImageTool } from "../types";

/**
 * Print patterns, after Benday: Ben-Day dots, halftone dot fades, lines,
 * grids, checks, waves and zigzags. Repeating patterns are SVG <pattern>
 * tiles, so they stay crisp at any size and tile seamlessly.
 */

const tile = (kind: string, s: number, d: number, fg: string): string => {
  const half = s / 2;
  switch (kind) {
    case "dots-offset":
      return `<circle cx="${half / 2}" cy="${half / 2}" r="${d / 2}" fill="${fg}"/><circle cx="${half * 1.5}" cy="${half * 1.5}" r="${d / 2}" fill="${fg}"/>`;
    case "lines":
      return `<rect width="${s}" height="${d}" fill="${fg}"/>`;
    case "grid":
      return `<path d="M0 0H${s}M0 0V${s}" stroke="${fg}" stroke-width="${d}" fill="none"/>`;
    case "checks":
      return `<rect width="${half}" height="${half}" fill="${fg}"/><rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${fg}"/>`;
    case "waves":
      return `<path d="M0 ${half} Q ${s / 4} ${half - s / 3} ${half} ${half} T ${s} ${half}" stroke="${fg}" stroke-width="${d}" fill="none"/>`;
    case "zigzag":
      return `<path d="M0 ${half + s / 4} L ${half} ${half - s / 4} L ${s} ${half + s / 4}" stroke="${fg}" stroke-width="${d}" fill="none" stroke-linejoin="miter"/>`;
    case "crosses":
      return `<path d="M${half} ${half - d * 1.5}V${half + d * 1.5}M${half - d * 1.5} ${half}H${half + d * 1.5}" stroke="${fg}" stroke-width="${r2(d / 2.5)}"/>`;
    default:
      return `<circle cx="${half}" cy="${half}" r="${d / 2}" fill="${fg}"/>`;
  }
};

/** Dots that grow across the image: the comic-print fade. */
const halftone = (
  w: number,
  h: number,
  s: number,
  angle: number,
  fg: string,
  direction: string
): string => {
  const dots: string[] = [];
  const diag = Math.hypot(w, h);
  for (let y = -diag; y < diag; y += s) {
    for (let x = -diag; x < diag; x += s) {
      const rad = (angle * Math.PI) / 180;
      const px = w / 2 + x * Math.cos(rad) - y * Math.sin(rad);
      const py = h / 2 + x * Math.sin(rad) + y * Math.cos(rad);
      if (px < -s / 2 || py < -s / 2 || px > w + s / 2 || py > h + s / 2) {
        continue;
      }
      const fades: Record<string, number> = {
        horizontal: px / w,
        radial:
          1 - Math.min(1, Math.hypot(px - w / 2, py - h / 2) / (diag / 2)),
      };
      const t = Math.min(1, Math.max(0, fades[direction] ?? py / h));
      const r = Math.max(0, t) * s * 0.62;
      if (r > 0.3) {
        dots.push(`<circle cx="${r2(px)}" cy="${r2(py)}" r="${r2(r)}"/>`);
      }
    }
  }
  return `<g fill="${fg}">${dots.join("")}</g>`;
};

const NOT_ID = /[^A-Za-z0-9_-]/g;

export const patternTool: ImageTool = {
  blurb: "Ben-Day dots, halftone fades, lines, grids, checks and waves.",
  css: (v) => {
    const s = Number(v.spacing);
    const d = Number(v.size);
    if (v.kind !== "dots") {
      return null;
    }
    return `background-color: ${v.bg};\nbackground-image: radial-gradient(${v.fg} ${r2(d / 2)}px, transparent ${r2(d / 2 + 0.5)}px);\nbackground-size: ${s}px ${s}px;`;
  },
  id: "pattern",
  kind: "image",
  name: "Pattern Studio",
  params: [
    {
      default: "dots",
      key: "kind",
      label: "Pattern",
      options: [
        { label: "Ben-Day dots", value: "dots" },
        { label: "Offset dots", value: "dots-offset" },
        { label: "Halftone fade", value: "halftone" },
        { label: "Lines", value: "lines" },
        { label: "Grid", value: "grid" },
        { label: "Checks", value: "checks" },
        { label: "Waves", value: "waves" },
        { label: "Zigzag", value: "zigzag" },
        { label: "Crosses", value: "crosses" },
      ],
      type: "select",
    },
    {
      default: 24,
      key: "spacing",
      label: "Spacing",
      max: 160,
      min: 6,
      type: "range",
    },
    {
      default: 10,
      key: "size",
      label: "Size / weight",
      max: 80,
      min: 1,
      type: "range",
    },
    {
      default: 45,
      key: "angle",
      label: "Angle",
      max: 180,
      min: 0,
      type: "range",
    },
    {
      default: "vertical",
      key: "direction",
      label: "Fade (halftone)",
      options: [
        { label: "Top to bottom", value: "vertical" },
        { label: "Left to right", value: "horizontal" },
        { label: "From the centre", value: "radial" },
      ],
      type: "select",
    },
    { default: "", key: "fg", label: "Ink", type: "color" },
    { default: "", key: "bg", label: "Paper", type: "color" },
  ],
  render: (v, { height: h, palette, width: w }) => {
    const fg = esc(String(v.fg || palette[0] || "#000000"));
    const bg = esc(String(v.bg || palette.at(-1) || "#ffffff"));
    const s = Number(v.spacing) || 24;
    const d = Math.min(Number(v.size) || 10, s);
    const angle = Number(v.angle) || 0;
    const ground = `<rect width="${w}" height="${h}" fill="${bg}"/>`;
    if (v.kind === "halftone") {
      return svgDoc(
        w,
        h,
        ground + halftone(w, h, s, angle, fg, String(v.direction))
      );
    }
    // Named for what it draws, not just "p": two patterns' SVGs inlined in
    // one page (an export, a composition) would otherwise both paint the
    // first one's tile.
    const id = `pattern-${String(v.kind)}-${s}-${d}-${angle}`.replace(
      NOT_ID,
      "_"
    );
    return svgDoc(
      w,
      h,
      `<defs><pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">${tile(String(v.kind), s, d, fg)}</pattern></defs>${ground}<rect width="${w}" height="${h}" fill="url(#${id})"/>`
    );
  },
  // Plain shapes and a tile, no filters: it stays vector on the board and in
  // a frame, so it prints sharp at any size, rather than going in as a PNG.
  vector: true,
};
