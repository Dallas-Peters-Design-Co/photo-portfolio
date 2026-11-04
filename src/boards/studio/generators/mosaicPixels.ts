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
    if (paintCache.size > 8192) {
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

/** A shape's pixels in a w × h box, worked out once per size. */
const masks = new Map<string, Uint8Array | null>();
const maskOf = (kind: string, w: number, h: number, flip: boolean) => {
  const key = `${kind}${w}x${h}${flip ? "f" : ""}`;
  if (!masks.has(key)) {
    const c = Math.min(w, h) / 2;
    const inside = insideOf(kind, c, flip);
    let mask: Uint8Array | null = null;
    if (inside) {
      mask = new Uint8Array(w * h);
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          mask[y * w + x] = inside(x + 0.5 - w / 2, y + 0.5 - h / 2) ? 1 : 0;
        }
      }
    }
    if (masks.size > 256) {
      masks.clear();
    }
    masks.set(key, mask);
  }
  return masks.get(key) ?? null;
};

/**
 * The preview: every tile written straight into the canvas's pixels at the
 * size it's shown, then put on screen in one go. Tens of thousands of canvas
 * calls, each parsing a colour, cost more than the tiles themselves; filling
 * rows of packed pixels is a few milliseconds even at 160 tiles across.
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
  const out = g.createImageData(pw, ph);
  const px = out.data;
  const u32 = new Uint32Array(px.buffer);
  if (ground) {
    const p = paintOfColour(ground);
    if (p.a >= 1) {
      u32.fill(p.packed);
    } else {
      for (let i = 0; i < px.length; i += 4) {
        px[i] = p.r;
        px[i + 1] = p.g;
        px[i + 2] = p.b;
        px[i + 3] = p.a * 255;
      }
    }
  }
  /** A see-through tile over whatever is there (the background, or nothing). */
  const blend = (i: number, p: Paint) => {
    const da = (px[i + 3] ?? 0) / 255;
    const oa = p.a + da * (1 - p.a);
    const mix = (s: number, d: number) => (s * p.a + d * da * (1 - p.a)) / oa;
    px[i] = mix(p.r, px[i] ?? 0);
    px[i + 1] = mix(p.g, px[i + 1] ?? 0);
    px[i + 2] = mix(p.b, px[i + 2] ?? 0);
    px[i + 3] = oa * 255;
  };
  /** One row of a shaped or see-through tile, pixel by pixel. */
  const spanOf = (
    row: number,
    x0: number,
    x1: number,
    mask: Uint8Array | null,
    m: number,
    p: Paint
  ) => {
    for (let xx = x0; xx < x1; xx += 1) {
      if (mask && !mask[m + xx - x0]) {
        continue;
      }
      if (p.a >= 1) {
        u32[row + xx] = p.packed;
      } else {
        blend((row + xx) * 4, p);
      }
    }
  };
  each((kind, x, y, s, colour, flip) => {
    const p = paintOfColour(colour);
    if (p.a <= 0.002) {
      return;
    }
    const x0 = Math.max(0, Math.round(x * kx));
    const y0 = Math.max(0, Math.round(y * ky));
    const x1 = Math.min(pw, Math.max(x0 + 1, Math.round((x + s) * kx)));
    const y1 = Math.min(ph, Math.max(y0 + 1, Math.round((y + s) * ky)));
    const w = x1 - x0;
    const mask = maskOf(kind, w, y1 - y0, flip);
    for (let yy = y0; yy < y1; yy += 1) {
      const row = yy * pw;
      if (!mask && p.a >= 1) {
        u32.fill(p.packed, row + x0, row + x1);
      } else {
        spanOf(row, x0, x1, mask, (yy - y0) * w, p);
      }
    }
  });
  g.putImageData(out, 0, 0);
};
