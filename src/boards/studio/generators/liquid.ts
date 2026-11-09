import { rng, svgDoc } from "../rng";
import type { ImageTool, RenderContext, StudioValues } from "../types";
import { numberOr, oklabOf } from "./liquidColour";
import {
  LIQUID_COLOURS,
  LIQUID_LOOKS,
  type LiquidFrame,
  type LiquidLook,
  liquidLimit,
  paintLiquid,
} from "./liquidGl";
import {
  adjustCss,
  adjustOf,
  adjustSvg,
  discsSvg,
  drawDiscs,
  isPlain,
  rampSvg,
} from "./liquidSvg";
import { grain } from "./mesh";

/**
 * Liquid Gradients: colour that looks poured rather than drawn, in the
 * brand's colours. Four looks: Silk and Marble from a shader (liquidGl.ts),
 * Aura and Mesh as plain SVG discs (liquidSvg.ts).
 *
 * The file is kept light. Aura and Mesh are vector through and through. Silk
 * and Marble have to carry a picture, so it is WebP, drawn no larger than
 * `RASTER` on a side and stretched: poured colour has no fine detail to lose,
 * and a 24×36 poster as PNG would be a hundred megabytes. The grain and the
 * adjustments go over the top as SVG filters, so they add nothing to the
 * file and stay one pixel fine at any size.
 *
 * "Moment" is where in its loop the picture is stopped. A video reads the
 * same loop from `liquidPhase` (0 to 1), which no control shows.
 */

const TAU = Math.PI * 2;
/** The longest side the shader looks are drawn at before being stretched. */
const RASTER = 2048;
/** What `toDataURL` begins with when the browser can write WebP. */
const WEBP_PREFIX = "data:image/webp";

const lookOf = (v: StudioValues): LiquidLook =>
  LIQUID_LOOKS.find((look) => look === v.look) ?? "silk";

const isShader = (look: LiquidLook) => look === "silk" || look === "marble";

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

/** Everything a look needs for these settings and colours. */
export const liquidFrame = (
  v: StudioValues,
  palette: string[]
): LiquidFrame => {
  const colours = palette.slice(0, LIQUID_COLOURS);
  const random = rng(numberOr(v.seed, 1) || 1);
  const seed = [random(), random(), random(), random()] as LiquidFrame["seed"];
  const phase = numberOr(v.moment, 0) / 100 + numberOr(v.liquidPhase, 0);
  return {
    angle: (numberOr(v.angle, 0) / 360) * TAU,
    colours: colours.map(oklabOf),
    look: lookOf(v),
    phase: ((phase % 1) + 1) % 1,
    points: pointsOf(colours.length, random),
    // The slider is how big the features are; the maths wants how many fit.
    scale: 1 / Math.max(0.05, numberOr(v.scale, 100) / 100),
    seed,
    soft: Math.max(0, Math.min(1, numberOr(v.soft, 70) / 100)),
    warp: Math.max(0, numberOr(v.warp, 100) / 100),
  };
};

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

/** A scratch canvas the preview draws colour on before adjusting it. */
let scratch: HTMLCanvasElement | null = null;
const scratchFor = (width: number, height: number) => {
  scratch ??= document.createElement("canvas");
  if (scratch.width !== width || scratch.height !== height) {
    scratch.width = width;
    scratch.height = height;
  }
  return scratch;
};

/** The colour of the preview, before grain, onto `g`. */
const drawColour = (
  g: CanvasRenderingContext2D,
  frame: LiquidFrame,
  palette: string[]
) => {
  const { height, width } = g.canvas;
  if (isShader(frame.look)) {
    const picture = paintLiquid(frame, width, height);
    if (picture) {
      g.drawImage(picture, 0, 0, width, height);
      return;
    }
    const fill = g.createLinearGradient(0, 0, width, height);
    const stops = palette.length > 1 ? palette : [...palette, ...palette];
    for (const [i, c] of stops.entries()) {
      fill.addColorStop(i / (stops.length - 1), c);
    }
    g.fillStyle = fill;
    g.fillRect(0, 0, width, height);
    return;
  }
  drawDiscs(g, frame);
};

/** The shader looks' pixel size: as asked, or as large as will be carried. */
const rasterSize = ({ height, width }: RenderContext) => {
  const k = Math.min(
    1,
    Math.min(RASTER, liquidLimit()) / Math.max(width, height)
  );
  return {
    h: Math.max(1, Math.round(height * k)),
    w: Math.max(1, Math.round(width * k)),
  };
};

/** The picture as a data URL: WebP where the browser writes it, else PNG. */
const encoded = (canvas: HTMLCanvasElement) => {
  const webp = canvas.toDataURL("image/webp", 0.9);
  return webp.startsWith(WEBP_PREFIX) ? webp : canvas.toDataURL("image/png");
};

/** The colour part of the file: a picture for the shader looks, discs else. */
const colourSvg = (
  frame: LiquidFrame,
  ctx: RenderContext
): { body: string; defs: string } => {
  const { height: h, palette, width: w } = ctx;
  if (!isShader(frame.look)) {
    return discsSvg(frame, w, h);
  }
  const size = rasterSize(ctx);
  const picture = paintLiquid(frame, size.w, size.h);
  if (!picture) {
    return {
      body: `<rect width="${w}" height="${h}" fill="url(#l)"/>`,
      defs: rampSvg(palette),
    };
  }
  return {
    body: `<image width="${w}" height="${h}" preserveAspectRatio="none" href="${encoded(picture)}"/>`,
    defs: "",
  };
};

const range = (
  key: string,
  label: string,
  fallback: number,
  min: number,
  max: number
) => ({ default: fallback, key, label, max, min, type: "range" as const });

export const liquidTool: ImageTool = {
  blurb:
    "Colour that looks poured: silk folds, marble veins, soft auras and blended mesh, in the brand colours.",
  draw: (g, v, ctx) => {
    const { height, width } = g.canvas;
    const frame = liquidFrame(v, ctx.palette);
    const adjust = adjustOf(v);
    if (isPlain(adjust)) {
      drawColour(g, frame, ctx.palette);
    } else {
      const under = scratchFor(width, height);
      const ug = under.getContext("2d");
      if (ug) {
        ug.clearRect(0, 0, width, height);
        drawColour(ug, frame, ctx.palette);
        g.save();
        g.filter = adjustCss(adjust);
        g.drawImage(under, 0, 0);
        g.restore();
      }
    }
    drawGrain(g, numberOr(v.grain, 0));
  },
  id: "liquid",
  kind: "image",
  looks: [
    { name: "Silk (slow folds)", values: {} },
    {
      name: "Silk, hard bands",
      values: { grain: 0, look: "silk", scale: 125, soft: 6, warp: 150 },
    },
    {
      name: "Marble veins",
      values: { grain: 8, look: "marble", scale: 90, soft: 40, warp: 130 },
    },
    {
      name: "Marble, smoke",
      values: { grain: 20, look: "marble", scale: 165, soft: 100, warp: 70 },
    },
    {
      name: "Aura (soft lights)",
      values: { grain: 18, look: "aura", scale: 110, soft: 80, warp: 60 },
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
    range("scale", "Scale", 100, 33, 300),
    range("warp", "Swirl", 100, 0, 200),
    range("soft", "Softness", 70, 0, 100),
    range("angle", "Angle", 0, 0, 360),
    range("moment", "Moment", 0, 0, 100),
    range("grain", "Grain", 12, 0, 60),
    range("brightness", "Brightness", 100, 50, 150),
    range("contrast", "Contrast", 100, 50, 150),
    range("saturation", "Saturation", 100, 0, 200),
    range("hue", "Hue", 0, -180, 180),
  ],
  render: (v, ctx) => {
    const { height: h, width: w } = ctx;
    const amount = numberOr(v.grain, 0);
    const adjust = adjustOf(v);
    const colour = colourSvg(liquidFrame(v, ctx.palette), ctx);
    const adjusted = isPlain(adjust)
      ? colour.body
      : `<g filter="url(#a)">${colour.body}</g>`;
    const grained =
      amount > 0 ? `<rect width="${w}" height="${h}" filter="url(#g)"/>` : "";
    return svgDoc(
      w,
      h,
      `<defs>${colour.defs}${adjustSvg(adjust)}${grain(amount)}</defs>${adjusted}${grained}`
    );
  },
};
