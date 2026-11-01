import { esc, pick, r2, svgDoc } from "../rng";
import type { ImageTool } from "../types";

/**
 * A picture as a tile mosaic, after Mozayk: the image is averaged into a grid
 * and each cell drawn as a square, circle, diamond, triangle or hexagon, in
 * the photo's own colours or snapped to the brand's.
 */

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;

const rgb = (h: string) =>
  [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) || 0);

const nearest = (r: number, g: number, b: number, palette: string[]) => {
  let best = palette[0] ?? "#000000";
  let bestD = Number.POSITIVE_INFINITY;
  for (const p of palette) {
    const [pr = 0, pg = 0, pb = 0] = rgb(p);
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

export const mosaicTool: ImageTool = {
  blurb: "A picture rebuilt from tiles, in its own colours or the brand's.",
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
      default: false,
      key: "brand",
      label: "Snap to brand colours",
      type: "checkbox",
    },
  ],
  render: (v, { height: h, image, palette, width: w }) => {
    const ground = esc(pick(palette, palette.length - 1));
    if (!image) {
      return svgDoc(
        w,
        h,
        `<rect width="${w}" height="${h}" fill="${ground}"/><text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="${r2(w / 24)}" fill="${esc(pick(palette, 0))}">Choose a picture</text>`
      );
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
    if (!data) {
      return svgDoc(w, h, "");
    }
    const inset = cell * ((Number(v.gap) || 0) / 100);
    const s = cell - inset * 2;
    const tiles: string[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const i = (row * cols + col) * 4;
        const [r = 0, g = 0, b = 0] = [data[i], data[i + 1], data[i + 2]];
        const fill = v.brand ? nearest(r, g, b, palette) : hex(r, g, b);
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
    return svgDoc(
      w,
      h,
      `<rect width="${w}" height="${h}" fill="${ground}"/>${tiles.join("")}`
    );
  },
};
