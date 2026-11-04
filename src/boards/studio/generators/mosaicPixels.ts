import type { RenderContext } from "../types";

/**
 * The mosaic preview, drawn as pixels (mosaic.ts makes the tiles; this puts
 * them on a canvas). The SVG is still what goes on the board.
 */

export type TileEmit = (
  kind: string,
  x: number,
  y: number,
  s: number,
  colour: string,
  flip: boolean
) => void;

/** "#rrggbb" or "#rrggbbaa" as channels and as one packed RGBA pixel. */
interface Paint {
  a: number;
  b: number;
  g: number;
  packed: number;
  r: number;
}
const paintCache = new Map<string, Paint>();
const paintOfColour = (colour: string): Paint => {
  let c = paintCache.get(colour);
  if (!c) {
    const n = (i: number) => Number.parseInt(colour.slice(i, i + 2), 16) || 0;
    const [r, g, b] = colour.length >= 7 ? [n(1), n(3), n(5)] : [0, 0, 0];
    const a = colour.length === 9 ? n(7) / 255 : 1;
    // Little-endian, as every browser lays ImageData out: R first.
    const packed = 255 * 2 ** 24 + b * 2 ** 16 + g * 2 ** 8 + r;
    c = { a, b, g, packed, r };
    if (paintCache.size > 65_536) {
      paintCache.clear();
    }
    paintCache.set(colour, c);
  }
  return c;
};

/** Whether a point, relative to a tile's centre, is inside its shape. */
const insideOf = (kind: string, c: number, flip: boolean) => {
  if (kind === "circle") {
    return (dx: number, dy: number) => dx * dx + dy * dy <= c * c;
  }
  if (kind === "diamond") {
    return (dx: number, dy: number) => Math.abs(dx) + Math.abs(dy) <= c;
  }
  if (kind === "triangle") {
    // Point down (or up when flipped): the sides close in towards the tip.
    return (dx: number, dy: number) => {
      const t = flip ? (dy + c) / (2 * c) : (c - dy) / (2 * c);
      return Math.abs(dx) <= c * t;
    };
  }
  if (kind === "hex") {
    // Pointy-top hexagon of circumradius c.
    const h = (c * Math.sqrt(3)) / 2;
    return (dx: number, dy: number) => {
      const ax = Math.abs(dx);
      return ax <= h && Math.abs(dy) <= c - ax / Math.sqrt(3);
    };
  }
  return null;
};

/** How much of [a, b) falls in the pixel [p, p + 1). */
const overlap = (p: number, a: number, b: number) =>
  Math.max(0, Math.min(p + 1, b) - Math.max(p, a));

const SUB = 4;

/**
 * How much of each pixel a tile covers, 0 to 1, for a tile that starts `ox`,
 * `oy` into its first pixel and is `fw` × `fh` pixels. Partly covered pixels
 * at the edges are what keep every gap the same width on screen: rounding
 * each tile to whole pixels made some gaps a pixel wide and others gone.
 * Offsets and sizes come in quarter pixels, so a handful of these serve every
 * tile in the mosaic.
 */
const coverage = new Map<string, { cover: Float32Array; w: number }>();

/** Of one pixel, the share inside a shape: sampled SUB × SUB times. */
const sampled = (
  inside: (dx: number, dy: number) => boolean,
  x: number,
  y: number
) => {
  let n = 0;
  for (let sy = 0; sy < SUB; sy += 1) {
    for (let sx = 0; sx < SUB; sx += 1) {
      n += inside(x + (sx + 0.5) / SUB, y + (sy + 0.5) / SUB) ? 1 : 0;
    }
  }
  return n / (SUB * SUB);
};

const coverGrid = (
  kind: string,
  ox: number,
  oy: number,
  fw: number,
  fh: number,
  flip: boolean,
  w: number,
  h: number
) => {
  const cover = new Float32Array(w * h);
  const shape = insideOf(kind, Math.min(fw, fh) / 2, flip);
  // Relative to the tile's centre.
  const inside = shape
    ? (px: number, py: number) => shape(px - ox - fw / 2, py - oy - fh / 2)
    : null;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      cover[y * w + x] = inside
        ? sampled(inside, x, y)
        : overlap(x, ox, ox + fw) * overlap(y, oy, oy + fh);
    }
  }
  return cover;
};
const coverOf = (
  kind: string,
  ox: number,
  oy: number,
  fw: number,
  fh: number,
  flip: boolean
) => {
  const key = `${kind}|${ox}|${oy}|${fw}|${fh}|${flip ? 1 : 0}`;
  let hit = coverage.get(key);
  if (!hit) {
    const w = Math.ceil(ox + fw);
    const cover = coverGrid(kind, ox, oy, fw, fh, flip, w, Math.ceil(oy + fh));
    if (coverage.size > 512) {
      coverage.clear();
    }
    hit = { cover, w };
    coverage.set(key, hit);
  }
  return hit;
};

const quarter = (n: number) => Math.round(n * 4) / 4;

/** Working space for a preview this size, kept between redraws and cleared. */
let buffers: {
  full: Uint8Array;
  n: number;
  sa: Float32Array;
  sb: Float32Array;
  sg: Float32Array;
  sr: Float32Array;
} | null = null;
const buffersFor = (n: number) => {
  if (buffers?.n === n) {
    buffers.full.fill(0);
    buffers.sa.fill(0);
    buffers.sb.fill(0);
    buffers.sg.fill(0);
    buffers.sr.fill(0);
  } else {
    buffers = {
      full: new Uint8Array(n),
      n,
      sa: new Float32Array(n),
      sb: new Float32Array(n),
      sg: new Float32Array(n),
      sr: new Float32Array(n),
    };
  }
  return buffers;
};

/**
 * The preview: every tile written straight into the canvas's pixels at the
 * size it's shown, then put on screen in one go. Tens of thousands of canvas
 * calls, each parsing a colour, cost more than the tiles themselves.
 *
 * Tiles never overlap, so each pixel's share of every tile touching it is
 * simply added up, then laid over the background once. Blending the tiles
 * one after another instead made a pixel shared by two tile edges come out
 * darker than either, and the gaps looked uneven.
 */
export const drawPixels = (
  g: CanvasRenderingContext2D,
  ctx: RenderContext,
  /** The background colour, or null for none. */
  ground: string | null,
  each: (emit: TileEmit) => void
) => {
  const pw = g.canvas.width;
  const ph = g.canvas.height;
  const kx = pw / ctx.width;
  const ky = ph / ctx.height;
  const n = pw * ph;
  const out = g.createImageData(pw, ph);
  const px = out.data;
  const u32 = new Uint32Array(px.buffer);
  // Pixels wholly inside one opaque tile are written straight away; only
  // the edges, which tiles can share, are summed and finished at the end.
  const { full, sa, sb, sg, sr } = buffersFor(n);
  /** A tile's share of a pixel it only partly covers (or isn't solid). */
  const edge = (at: number, p: Paint, c: number) => {
    sr[at] = (sr[at] ?? 0) + p.r * c;
    sg[at] = (sg[at] ?? 0) + p.g * c;
    sb[at] = (sb[at] ?? 0) + p.b * c;
    sa[at] = (sa[at] ?? 0) + c;
  };
  const add = (
    x0: number,
    y0: number,
    cover: Float32Array,
    w: number,
    p: Paint
  ) => {
    const h = cover.length / w;
    const solid = p.a >= 1;
    for (let r = 0; r < h; r += 1) {
      const yy = y0 + r;
      if (yy < 0 || yy >= ph) {
        continue;
      }
      const row = yy * pw;
      for (let i = 0; i < w; i += 1) {
        const xx = x0 + i;
        const c = (cover[r * w + i] ?? 0) * p.a;
        if (xx < 0 || xx >= pw || c <= 0) {
          continue;
        }
        const at = row + xx;
        if (solid && c >= 0.999) {
          u32[at] = p.packed;
          full[at] = 1;
          continue;
        }
        edge(at, p, c);
      }
    }
  };
  // Every tile is the same size, so only its offset into its first pixel
  // (in quarters) and its flip change: sixteen-odd coverages per redraw.
  const local = new Map<number, { cover: Float32Array; w: number }>();
  each((kind, x, y, s, colour, flip) => {
    const p = paintOfColour(colour);
    if (p.a <= 0.002) {
      return;
    }
    const fx = x * kx;
    const fy = y * ky;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const qx = quarter(fx - x0);
    const qy = quarter(fy - y0);
    const slot = (qx * 4 * 5 + qy * 4) * 2 + (flip ? 1 : 0);
    let hit = local.get(slot);
    if (!hit) {
      hit = coverOf(
        kind === "square" ? "" : kind,
        qx,
        qy,
        quarter(s * kx),
        quarter(s * ky),
        flip
      );
      local.set(slot, hit);
    }
    add(x0, y0, hit.cover, hit.w, p);
  });
  const back = ground ? paintOfColour(ground) : null;
  for (let at = 0; at < n; at += 1) {
    if (full[at]) {
      continue;
    }
    const sum = sa[at] ?? 0;
    const a = Math.min(1, sum);
    // Over the background: tile where covered, background showing through.
    const ba = back ? back.a * (1 - a) : 0;
    const oa = a + ba;
    if (oa <= 0) {
      continue;
    }
    const k = a > 0 ? a / sum : 0;
    const i = at * 4;
    px[i] = ((sr[at] ?? 0) * k + (back?.r ?? 0) * ba) / oa;
    px[i + 1] = ((sg[at] ?? 0) * k + (back?.g ?? 0) * ba) / oa;
    px[i + 2] = ((sb[at] ?? 0) * k + (back?.b ?? 0) * ba) / oa;
    px[i + 3] = oa * 255;
  }
  g.putImageData(out, 0, 0);
};
