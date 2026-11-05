import { colorsOf } from "../chosenColors";
import { esc, pick, r2, rng, svgDoc } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { clouds, coverSample, lumAt, numOr } from "./cellField";
import {
  drawGrid,
  gridFrom,
  gridParams,
  gridSvg,
  linesLook,
} from "./gridLines";
import { paintOf } from "./mosaicSvg";

/**
 * Grid Boxes: a picture under a grid, with cells of solid colour laid over
 * it. Some cells show the picture, some are plain ground, some are boxes of
 * colour: scattered, gathered into one pixel blob with fragments breaking off
 * its edge, or placed where the picture is brightest.
 */

type Cell = { colour: string } | "ground" | "photo";

const photoCache = new WeakMap<object, Map<string, HTMLCanvasElement>>();

/** The picture covering the piece: black and white or its own colours. */
const photoOf = (v: StudioValues, ctx: RenderContext) => {
  const { image } = ctx;
  if (!image) {
    return null;
  }
  const scale = Math.min(1, 1600 / Math.max(ctx.width, ctx.height));
  const w = Math.round(ctx.width * scale);
  const h = Math.round(ctx.height * scale);
  const mono = v.photo !== "own";
  const contrast = Math.max(0, Number(v.photoContrast) || 100);
  const key = [w, h, mono, contrast].join("|");
  const byImage = photoCache.get(image) ?? new Map<string, HTMLCanvasElement>();
  photoCache.set(image, byImage);
  const had = byImage.get(key);
  if (had) {
    return had;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (g) {
    const s = Math.max(w / image.width, h / image.height);
    const sw = w / s;
    const sh = h / s;
    g.filter = `${mono ? "grayscale(1) " : ""}contrast(${contrast}%)`;
    g.drawImage(
      image,
      (image.width - sw) / 2,
      (image.height - sh) / 2,
      sw,
      sh,
      0,
      0,
      w,
      h
    );
  }
  if (byImage.size > 6) {
    byImage.clear();
  }
  byImage.set(key, canvas);
  return canvas;
};

/** Which cells are boxes: a share of them, by the layout chosen. */
const boxesOf = (
  v: StudioValues,
  ctx: RenderContext,
  cols: number,
  rows: number
): boolean[] => {
  const n = cols * rows;
  const share = Math.max(0, Math.min(100, numOr(v.boxes, 35))) / 100;
  const seed = Number(v.seed) || 1;
  const rand = rng(seed + 3);
  // A score per cell; the top `share` of cells become boxes.
  let score: Float32Array;
  if (v.layout === "picture" && ctx.image) {
    const data = coverSample(ctx.image, cols, rows, ctx);
    score = Float32Array.from(
      { length: n },
      (_, i) => lumAt(data, i) + rand() * 0.05
    );
  } else if (v.layout === "blob") {
    score = clouds(cols, rows, seed, Math.max(10, Number(v.size) || 45) / 100);
  } else {
    score = Float32Array.from({ length: n }, rand);
  }
  const cut =
    [...score].sort((a, b) => b - a)[Math.max(0, Math.round(share * n) - 1)] ??
    1;
  const on = [...score].map((s) => share > 0 && s >= cut);
  return v.layout === "blob" ? withFragments(on, cols, rows, v, rand) : on;
};

/**
 * A blob's ragged edge: cells just outside it break off as fragments, and a
 * few just inside drop out, so it reads as pixels coming apart.
 */
const withFragments = (
  on: boolean[],
  cols: number,
  rows: number,
  v: StudioValues,
  rand: () => number
): boolean[] => {
  const amount = Math.max(0, Number(v.fragments) || 0) / 100;
  const near = (i: number, reach: number) => {
    const c = i % cols;
    const r = (i - c) / cols;
    for (let dy = -reach; dy <= reach; dy += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        const cc = c + dx;
        const rr = r + dy;
        if (
          cc >= 0 &&
          rr >= 0 &&
          cc < cols &&
          rr < rows &&
          on[rr * cols + cc]
        ) {
          return true;
        }
      }
    }
    return false;
  };
  return on.map((was, i) => {
    if (was) {
      return !(
        near(i, 1) &&
        !nearAll(on, i, cols, rows) &&
        rand() < amount * 0.25
      );
    }
    if (near(i, 1)) {
      return rand() < amount * 0.35;
    }
    return near(i, 3) && rand() < amount * 0.12;
  });
};

/** Whether every neighbour is in the blob (an inside cell, never dropped). */
const nearAll = (on: boolean[], i: number, cols: number, rows: number) => {
  const c = i % cols;
  const r = (i - c) / cols;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cc = c + dx;
      const rr = r + dy;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || !on[rr * cols + cc]) {
        return false;
      }
    }
  }
  return true;
};

/** Every cell's content. */
const cellsOf = (v: StudioValues, ctx: RenderContext) => {
  const grid = gridFrom(Math.max(2, Number(v.columns) || 6), ctx);
  const { cols, rows } = grid;
  const boxes = boxesOf(v, ctx, cols, rows);
  const colours = colorsOf(v.colors, ctx.palette, 1);
  const photoShare = Math.max(0, Math.min(100, numOr(v.photoShare, 50))) / 100;
  const rand = rng((Number(v.seed) || 1) + 11);
  const cells: Cell[] = boxes.map((isBox) => {
    const a = rand();
    const b = rand();
    if (isBox) {
      return { colour: pick(colours, Math.floor(b * colours.length)) };
    }
    return a < photoShare ? "photo" : "ground";
  });
  return { cells, grid };
};

const groundOf = (v: StudioValues) => String(v.ground || "#1c1c1e");

export const gridBoxesTool: ImageTool = {
  blurb:
    "A picture under a grid, with boxes of colour over some cells and plain ground over others: scattered, one pixel blob breaking apart, or on the brightest parts.",
  draw: (g, v, ctx) => {
    const { height: H, width: W } = g.canvas;
    const kx = W / ctx.width;
    const ky = H / ctx.height;
    g.clearRect(0, 0, W, H);
    const photo = photoOf(v, ctx);
    const { cells, grid } = cellsOf(v, ctx);
    if (photo) {
      g.drawImage(photo, 0, 0, W, H);
    } else {
      g.fillStyle = groundOf(v);
      g.fillRect(0, 0, W, H);
    }
    cells.forEach((cell, i) => {
      if (cell === "photo" && photo) {
        return;
      }
      const c = i % grid.cols;
      const r = (i - c) / grid.cols;
      g.fillStyle =
        cell === "ground" || cell === "photo" ? groundOf(v) : cell.colour;
      // Rounded out to whole pixels so neighbouring boxes meet without seams.
      const x0 = Math.round(c * grid.cell * kx);
      const y0 = Math.round(r * grid.cell * ky);
      g.fillRect(
        x0,
        y0,
        Math.round((c + 1) * grid.cell * kx) - x0,
        Math.round((r + 1) * grid.cell * ky) - y0
      );
    });
    drawGrid(g, grid, linesLook(v), ctx);
  },
  id: "grid-boxes",
  kind: "image",
  name: "Grid Boxes",
  params: [
    { key: "image", label: "Picture", type: "image" },
    {
      default: "bw",
      key: "photo",
      label: "Picture in",
      options: [
        { label: "Black and white", value: "bw" },
        { label: "Its own colours", value: "own" },
      ],
      type: "select",
    },
    {
      default: 120,
      key: "photoContrast",
      label: "Picture contrast",
      max: 250,
      min: 20,
      type: "range",
    },
    {
      default: "scatter",
      key: "layout",
      label: "Boxes",
      options: [
        { label: "Scattered", value: "scatter" },
        { label: "One blob, breaking apart", value: "blob" },
        { label: "On the brightest parts", value: "picture" },
      ],
      type: "select",
    },
    {
      default: 6,
      key: "columns",
      label: "Cells across",
      max: 80,
      min: 2,
      type: "range",
    },
    {
      default: 35,
      key: "boxes",
      label: "Boxes (% of cells)",
      max: 100,
      min: 0,
      type: "range",
    },
    {
      default: 45,
      key: "size",
      label: "Blob size",
      max: 100,
      min: 10,
      type: "range",
      when: (v) => v.layout === "blob",
    },
    {
      default: 50,
      key: "fragments",
      label: "Fragments",
      max: 100,
      min: 0,
      type: "range",
      when: (v) => v.layout === "blob",
    },
    {
      default: 50,
      key: "photoShare",
      label: "Picture showing (% of the other cells)",
      max: 100,
      min: 0,
      type: "range",
    },
    { count: 1, key: "colors", label: "Box colours", max: 6, type: "colors" },
    { default: "#1c1c1e", key: "ground", label: "Ground", type: "color" },
    ...gridParams({ crosses: true }),
    { key: "seed", label: "Variation", type: "seed" },
  ],
  render: (v, ctx) => {
    const { height: h, width: w } = ctx;
    const photo = photoOf(v, ctx);
    const { cells, grid } = cellsOf(v, ctx);
    const parts: string[] = [];
    if (photo) {
      parts.push(
        `<image href="${esc(photo.toDataURL("image/jpeg", 0.9))}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"/>`
      );
    } else {
      parts.push(
        `<rect width="${w}" height="${h}" ${paintOf(groundOf(v)) ?? ""}/>`
      );
    }
    cells.forEach((cell, i) => {
      if (cell === "photo" && photo) {
        return;
      }
      const c = i % grid.cols;
      const r = (i - c) / grid.cols;
      const fill = paintOf(
        typeof cell === "object" ? cell.colour : groundOf(v)
      );
      if (fill) {
        // A hair over size, so boxes side by side show no seam between them.
        parts.push(
          `<rect x="${r2(c * grid.cell)}" y="${r2(r * grid.cell)}" width="${r2(grid.cell + 0.5)}" height="${r2(grid.cell + 0.5)}" ${fill}/>`
        );
      }
    });
    parts.push(gridSvg(grid, linesLook(v), ctx));
    return svgDoc(w, h, parts.join(""));
  },
  vector: false,
};
