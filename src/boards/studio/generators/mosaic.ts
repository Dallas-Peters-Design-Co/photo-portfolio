import { esc, pick, r2, svgDoc } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import {
  hex,
  luma,
  mainColours,
  remapper,
  replacementsOf,
  rgb,
} from "./recolour";

/**
 * A picture as a tile mosaic, after Mozayk: the image is averaged into a grid
 * and each cell drawn as a square, circle, diamond, triangle or hexagon.
 *
 * Colour: the photo's own; recoloured, where the picture's main colours are
 * listed and each swapped for one you choose (recolour.ts); each tile snapped
 * to the nearest picked colour; by brightness, darkest tiles to the darkest
 * picked colour, in bands; or the same as a smooth gradient map.
 */

const byLuma = (palette: string[]) =>
  [...palette].sort((a, b) => {
    const [ar, ag, ab] = rgb(a);
    const [br, bg, bb] = rgb(b);
    return luma(ar, ag, ab) - luma(br, bg, bb);
  });

/** A brightness, 0 to 1, as one of the colours: dark to light, in bands. */
const band = (t: number, ramp: string[]) =>
  ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))] ?? "#000000";

/** A brightness, 0 to 1, blended smoothly along the colours. */
const blend = (t: number, ramp: string[]) => {
  if (ramp.length < 2) {
    return ramp[0] ?? "#000000";
  }
  const at = t * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(at));
  const f = at - i;
  const [ar, ag, ab] = rgb(ramp[i] ?? "#000000");
  const [br, bg, bb] = rgb(ramp[i + 1] ?? "#000000");
  return hex(ar + (br - ar) * f, ag + (bg - ag) * f, ab + (bb - ab) * f);
};

/** How a tile's averaged colour becomes its fill, for the chosen mode. */
const colourer = (
  mode: string,
  palette: string[],
  invert: boolean
): ((r: number, g: number, b: number) => string) => {
  if (mode === "nearest") {
    return (r, g, b) => nearest(r, g, b, palette);
  }
  if (mode === "tones" || mode === "blend") {
    const ramp = invert ? byLuma(palette).reverse() : byLuma(palette);
    const along = mode === "tones" ? band : blend;
    return (r, g, b) => along(luma(r, g, b) / 255, ramp);
  }
  return hex;
};

/** Earlier settings had a "Snap to brand colours" box rather than a mode. */
const modeOf = (v: Record<string, unknown>) => {
  if (typeof v.colour === "string" && v.colour) {
    return v.colour;
  }
  return v.brand ? "nearest" : "photo";
};

const nearest = (r: number, g: number, b: number, palette: string[]) => {
  let best = palette[0] ?? "#000000";
  let bestD = Number.POSITIVE_INFINITY;
  for (const p of palette) {
    const [pr, pg, pb] = rgb(p);
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
};

/** The picture averaged to cols × rows, as RGB triples. */
const sample = (
  image: CanvasImageSource & { height: number; width: number },
  cols: number,
  rows: number,
  w: number,
  h: number
): Uint8ClampedArray | null => {
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  // object-fit: cover onto the grid.
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    (image.width - sw) / 2,
    (image.height - sh) / 2,
    sw,
    sh,
    0,
    0,
    cols,
    rows
  );
  return ctx.getImageData(0, 0, cols, rows).data;
};

const shape = (
  kind: string,
  x: number,
  y: number,
  s: number,
  fill: string,
  flip: boolean
) => {
  const c = s / 2;
  switch (kind) {
    case "circle":
      return `<circle cx="${r2(x + c)}" cy="${r2(y + c)}" r="${r2(c)}" fill="${fill}"/>`;
    case "diamond":
      return `<path d="M${r2(x + c)} ${r2(y)}L${r2(x + s)} ${r2(y + c)}L${r2(x + c)} ${r2(y + s)}L${r2(x)} ${r2(y + c)}Z" fill="${fill}"/>`;
    case "triangle":
      return flip
        ? `<path d="M${r2(x)} ${r2(y + s)}L${r2(x + c)} ${r2(y)}L${r2(x + s)} ${r2(y + s)}Z" fill="${fill}"/>`
        : `<path d="M${r2(x)} ${r2(y)}L${r2(x + s)} ${r2(y)}L${r2(x + c)} ${r2(y + s)}Z" fill="${fill}"/>`;
    case "hex": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        return `${r2(x + c + Math.cos(a) * c)} ${r2(y + c + Math.sin(a) * c)}`;
      });
      return `<path d="M${pts.join("L")}Z" fill="${fill}"/>`;
    }
    default:
      return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(s)}" height="${r2(s)}" fill="${fill}"/>`;
  }
};

/** The picture averaged onto the mosaic's grid, or null without one. */
const gridOf = (
  v: StudioValues,
  { height: h, image, width: w }: RenderContext
) => {
  if (!image) {
    return null;
  }
  const cols = Math.max(2, Number(v.columns) || 48);
  const cell = w / cols;
  const rows = Math.max(1, Math.round(h / cell));
  const data = sample(
    image as CanvasImageSource & { height: number; width: number },
    cols,
    rows,
    w,
    h
  );
  return data ? { cell, cols, data, rows } : null;
};

const countOf = (v: StudioValues) =>
  Math.max(2, Math.min(12, Number(v.count) || 5));

export const mosaicTool: ImageTool = {
  blurb:
    "A picture rebuilt from tiles: in its own colours, snapped to yours, or recoloured by brightness. Goes in as an SVG.",
  id: "mosaic",
  kind: "image",
  name: "Mosaic",
  params: [
    { key: "image", label: "Picture", type: "image" },
    {
      default: "square",
      key: "tile",
      label: "Tile",
      options: [
        { label: "Squares", value: "square" },
        { label: "Circles", value: "circle" },
        { label: "Diamonds", value: "diamond" },
        { label: "Triangles", value: "triangle" },
        { label: "Hexagons", value: "hex" },
      ],
      type: "select",
    },
    {
      default: 48,
      key: "columns",
      label: "Tiles across",
      max: 160,
      min: 6,
      type: "range",
    },
    { default: 8, key: "gap", label: "Gap", max: 40, min: 0, type: "range" },
    {
      default: "photo",
      key: "colour",
      label: "Colour",
      options: [
        { label: "Photo's own", value: "photo" },
        { label: "Recolour (swap each colour)", value: "remap" },
        { label: "By brightness", value: "tones" },
        { label: "Gradient map", value: "blend" },
        { label: "Nearest picked colour", value: "nearest" },
      ],
      type: "select",
    },
    {
      default: 5,
      key: "count",
      label: "Colours in the picture",
      max: 12,
      min: 2,
      type: "range",
      when: (v) => modeOf(v) === "remap",
    },
    {
      key: "remap",
      label: "Swap",
      type: "remap",
      when: (v) => modeOf(v) === "remap",
    },
    {
      count: 4,
      key: "colors",
      label: "Colours",
      max: 8,
      type: "colors",
      when: (v) => ["tones", "blend", "nearest"].includes(modeOf(v)),
    },
    {
      default: false,
      key: "invert",
      label: "Light tiles get the dark colours",
      type: "checkbox",
      when: (v) => ["tones", "blend"].includes(modeOf(v)),
    },
    {
      default: false,
      key: "fill",
      label: "Fill the background",
      type: "checkbox",
    },
    {
      default: "#ffffff",
      key: "bg",
      label: "Background",
      type: "color",
      when: (v) => Boolean(v.fill),
    },
  ],
  render: (v, { height: h, image, palette, width: w }) => {
    const ground = esc(String(v.bg || pick(palette, palette.length - 1)));
    const groundRect = v.fill
      ? `<rect width="${w}" height="${h}" fill="${ground}"/>`
      : "";
    if (!image) {
      return svgDoc(
        w,
        h,
        `<rect width="${w}" height="${h}" fill="${ground}"/><text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="${r2(w / 24)}" fill="${esc(pick(palette, 0))}">Choose a picture</text>`
      );
    }
    const grid = gridOf(v, { height: h, image, palette, width: w });
    if (!grid) {
      return svgDoc(w, h, "");
    }
    const { cell, cols, data, rows } = grid;
    const mode = modeOf(v);
    const colour =
      mode === "remap"
        ? remapper(
            mainColours(data, countOf(v)),
            replacementsOf(v.remap, countOf(v))
          )
        : colourer(mode, palette, Boolean(v.invert));
    const inset = cell * ((Number(v.gap) || 0) / 100);
    const s = cell - inset * 2;
    const tiles: string[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const i = (row * cols + col) * 4;
        const [r = 0, g = 0, b = 0] = [data[i], data[i + 1], data[i + 2]];
        const fill = colour(r, g, b);
        tiles.push(
          shape(
            String(v.tile),
            col * cell + inset,
            row * cell + inset,
            s,
            fill,
            (col + row) % 2 === 0
          )
        );
      }
    }
    return svgDoc(w, h, `${groundRect}${tiles.join("")}`);
  },
  /** The picture's main colours, dark to light, for the Swap list. */
  sources: (v, ctx) => {
    const grid = modeOf(v) === "remap" ? gridOf(v, ctx) : null;
    return grid ? mainColours(grid.data, countOf(v)).map((c) => hex(...c)) : [];
  },
  vector: true,
};
