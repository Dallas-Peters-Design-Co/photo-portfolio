import { esc, r2, rng, svgDoc } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import {
  LIQUID_COLOURS,
  LIQUID_LOOKS,
  type LiquidFrame,
  type LiquidLook,
  liquidLimit,
  paintLiquid,
} from "./liquidGl";
import { grain } from "./mesh";

/**
 * Liquid Gradients: colour that looks poured rather than drawn, in the
 * brand's colours. Four looks from one shader (liquidGl.ts): silk, marble,
 * aura and mesh.
 *
 * The colour is worked out on the GPU and comes back as a picture; the grain
 * goes over it as an SVG filter, so it stays one pixel fine at any size while
 * the colour under it, which has no detail to lose, can be drawn smaller and
 * stretched (a 24×36 poster is more pixels than a GPU will draw in one go).
 *
 * "Moment" is where in its loop the picture is stopped. A video reads the
 * same loop from `liquidPhase` (0 to 1), which no control shows.
 */

const TAU = Math.PI * 2;
const HEX = /^#(?<hex>[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/iu;

/** `#rgb`, `#rrggbb` or `#rrggbbaa` as three 0–1 floats (black if neither). */
const rgbOf = (colour: string): [number, number, number] => {
  const raw = colour.trim().match(HEX)?.groups?.hex ?? "000000";
  const full =
    raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw.slice(0, 6);
  return [0, 2, 4].map(
    (at) => Number.parseInt(full.slice(at, at + 2), 16) / 255
  ) as [number, number, number];
};

const linear = (c: number) =>
  c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/**
 * A colour in OKLab, where a mix of two colours passes through the colours
 * between them rather than through grey (blue to yellow by way of green, not
 * mud).
 */
export const oklabOf = (colour: string): [number, number, number] => {
  const [r, g, b] = rgbOf(colour).map(linear) as [number, number, number];
  const l = Math.cbrt(
    0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b
  );
  const m = Math.cbrt(
    0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b
  );
  const s = Math.cbrt(
    0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b
  );
  return [
    0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
    0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
  ];
};

const lookOf = (v: StudioValues): LiquidLook =>
  LIQUID_LOOKS.find((look) => look === v.look) ?? "silk";

const numberOr = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * A point per colour, spread round the middle so no colour is left out of
 * the frame: its place, its size, and where on its orbit it starts.
 */
const pointsOf = (count: number, random: () => number) => {
  const turn = random();
  return Array.from({ length: count }, (_, i) => {
    const angle = TAU * (turn + (i + random() * 0.6) / count);
    const reach = 0.18 + random() * 0.26;
    return [
      0.5 + Math.cos(angle) * reach,
      0.5 + Math.sin(angle) * reach,
      0.35 + random() * 0.4,
      random() * TAU,
    ] as [number, number, number, number];
  });
};

/** Everything the shader needs for these settings and colours. */
export const liquidFrame = (
  v: StudioValues,
  palette: string[]
): LiquidFrame => {
  const colours = palette.slice(0, LIQUID_COLOURS);
  const random = rng(numberOr(v.seed, 1) || 1);
  const seed = [random(), random(), random(), random()] as LiquidFrame["seed"];
  const phase = numberOr(v.moment, 0) / 100 + numberOr(v.liquidPhase, 0);
  return {
    colours: colours.map(oklabOf),
    look: lookOf(v),
    phase: ((phase % 1) + 1) % 1,
    points: pointsOf(colours.length, random),
    scale: Math.max(0.05, numberOr(v.scale, 100) / 100),
    seed,
    soft: Math.max(0, Math.min(1, numberOr(v.soft, 70) / 100)),
    warp: Math.max(0, numberOr(v.warp, 100) / 100),
  };
};

/** The colours as plain stops, for a browser with no WebGL to draw with. */
const stopsOf = (palette: string[]) =>
  palette.length > 1
    ? palette
    : [palette[0] ?? "#000000", palette[0] ?? "#000000"];

/**
 * The grain the SVG filter makes, near enough, for the preview: a small tile
 * of grey specks, made once so the preview holds still while a slider moves.
 */
let speckTile: HTMLCanvasElement | null = null;
const specks = (): HTMLCanvasElement | null => {
  if (speckTile) {
    return speckTile;
  }
  const tile = document.createElement("canvas");
  tile.width = 128;
  tile.height = 128;
  const g = tile.getContext("2d");
  if (!g) {
    return null;
  }
  const random = rng(7);
  const data = g.createImageData(128, 128);
  for (let at = 0; at < data.data.length; at += 4) {
    const grey = 168 + random() * 40;
    data.data[at] = grey;
    data.data[at + 1] = grey;
    data.data[at + 2] = grey;
    data.data[at + 3] = 100 + random() * 55;
  }
  g.putImageData(data, 0, 0);
  speckTile = tile;
  return tile;
};

const drawGrain = (g: CanvasRenderingContext2D, amount: number) => {
  const tile = amount > 0 ? specks() : null;
  const pattern = tile ? g.createPattern(tile, "repeat") : null;
  if (!pattern) {
    return;
  }
  g.save();
  g.globalAlpha = Math.min(1, amount / 100);
  g.fillStyle = pattern;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.restore();
};

/** The picture's pixel size: its own, or as near as the GPU can draw. */
const drawnSize = ({ height, width }: RenderContext) => {
  const k = Math.min(1, liquidLimit() / Math.max(width, height));
  return {
    h: Math.max(1, Math.round(height * k)),
    w: Math.max(1, Math.round(width * k)),
  };
};

export const liquidTool: ImageTool = {
  blurb:
    "Colour that looks poured: silk folds, marble veins, soft auras and blended mesh, in the brand colours.",
  draw: (g, v, ctx) => {
    const { height, width } = g.canvas;
    const picture = paintLiquid(liquidFrame(v, ctx.palette), width, height);
    if (picture) {
      g.drawImage(picture, 0, 0, width, height);
    } else {
      const fill = g.createLinearGradient(0, 0, width, height);
      const stops = stopsOf(ctx.palette);
      for (const [i, c] of stops.entries()) {
        fill.addColorStop(i / (stops.length - 1), c);
      }
      g.fillStyle = fill;
      g.fillRect(0, 0, width, height);
    }
    drawGrain(g, numberOr(v.grain, 0));
  },
  id: "liquid",
  kind: "image",
  looks: [
    { name: "Silk (slow folds)", values: {} },
    {
      name: "Silk, hard bands",
      values: { grain: 0, look: "silk", scale: 80, soft: 6, warp: 150 },
    },
    {
      name: "Marble veins",
      values: { grain: 8, look: "marble", scale: 110, soft: 40, warp: 130 },
    },
    {
      name: "Marble, smoke",
      values: { grain: 20, look: "marble", scale: 60, soft: 100, warp: 70 },
    },
    {
      name: "Aura (soft lights)",
      values: { grain: 18, look: "aura", scale: 90, soft: 80, warp: 60 },
    },
    {
      name: "Mesh (blended)",
      values: { grain: 10, look: "mesh", scale: 100, soft: 60, warp: 100 },
    },
  ],
  name: "Liquid Gradients",
  params: [
    {
      default: "silk",
      key: "look",
      label: "Look",
      options: [
        { label: "Silk (flowing folds)", value: "silk" },
        { label: "Marble (veins)", value: "marble" },
        { label: "Aura (soft lights on the first colour)", value: "aura" },
        { label: "Mesh (colours blended from points)", value: "mesh" },
      ],
      type: "select",
    },
    {
      count: 4,
      key: "colors",
      label: "Colours",
      max: LIQUID_COLOURS,
      type: "colors",
    },
    { key: "seed", label: "Seed", type: "seed" },
    {
      default: 100,
      key: "scale",
      label: "Zoom",
      max: 300,
      min: 20,
      type: "range",
    },
    {
      default: 100,
      key: "warp",
      label: "Swirl",
      max: 200,
      min: 0,
      type: "range",
    },
    {
      default: 70,
      key: "soft",
      label: "Softness",
      max: 100,
      min: 0,
      type: "range",
    },
    {
      default: 0,
      key: "moment",
      label: "Moment",
      max: 100,
      min: 0,
      type: "range",
    },
    {
      default: 12,
      key: "grain",
      label: "Grain",
      max: 60,
      min: 0,
      type: "range",
    },
  ],
  render: (v, ctx) => {
    const { height: h, palette, width: w } = ctx;
    const amount = numberOr(v.grain, 0);
    const size = drawnSize(ctx);
    const picture = paintLiquid(liquidFrame(v, palette), size.w, size.h);
    const stops = stopsOf(palette).map(esc);
    const colour = picture
      ? `<image width="${w}" height="${h}" preserveAspectRatio="none" href="${picture.toDataURL("image/png")}"/>`
      : `<rect width="${w}" height="${h}" fill="url(#l)"/>`;
    const fallback = picture
      ? ""
      : `<linearGradient id="l" x1="0" y1="0" x2="1" y2="1">${stops
          .map(
            (c, i) =>
              `<stop offset="${r2((i / (stops.length - 1)) * 100)}%" stop-color="${c}"/>`
          )
          .join("")}</linearGradient>`;
    return svgDoc(
      w,
      h,
      `<defs>${fallback}${grain(amount)}</defs>${colour}${amount > 0 ? `<rect width="${w}" height="${h}" filter="url(#g)"/>` : ""}`
    );
  },
};
