import {
  hexToOklch,
  type Oklch,
  oklchToHex,
  toSrgbGamut,
} from "../../../lib/oklch";

/**
 * Palette Builder: a palette grown from one colour (the anchor) in OKLCH, so
 * "as light as" and "as vivid as" mean what the eye sees.
 *
 * Three choices shape it:
 *
 *   model    what the colours are for (see MODELS)
 *   hues     where the other hues sit: fanned beside the anchor, spread
 *            round the wheel, or split between the anchor and its opposite
 *   neutrals how many of the companions become quiet, tinted greys
 *
 * Everything is a pure function of the options, so the same settings always
 * give the same palette, and a locked colour is simply kept where it is.
 */

export const MODELS = [
  {
    blurb:
      "Every colour as light and as vivid as the anchor, so none outweighs another. For categories and tags.",
    id: "balance",
    label: "Balance",
  },
  {
    blurb:
      "Each hue at the lightness it's strongest at: yellows light, blues deep. Livelier, less even.",
    id: "adaptive",
    label: "Adaptive",
  },
  {
    blurb:
      "The anchor leads and the rest sit back: softer, alternately lighter and darker.",
    id: "companion",
    label: "Companion",
  },
  {
    blurb:
      "A working set for a layout: the anchor, then colours stepping from deep to pale to set it on.",
    id: "composition",
    label: "Composition",
  },
  {
    blurb:
      "One hue from light to dark, for amounts: more is darker. The anchor sits where its lightness falls.",
    id: "sequential",
    label: "Sequential",
  },
  {
    blurb:
      "Two hues meeting at a pale middle, for values either side of a centre.",
    id: "diverging",
    label: "Diverging",
  },
] as const;

export type SchemeModel = (typeof MODELS)[number]["id"];

export const HUE_MODES = [
  {
    blurb:
      "Colours sit beside the anchor on the wheel. A wider spread fans them further.",
    id: "nearby",
    label: "Nearby",
  },
  {
    blurb:
      "Colours are distributed around the wheel. A full spread gives equal spacing.",
    id: "spread",
    label: "Spread",
  },
  {
    blurb: "Half stay with the anchor and half sit across the wheel from it.",
    id: "opposite",
    label: "Opposite",
  },
] as const;

export type HueMode = (typeof HUE_MODES)[number]["id"];

export interface SchemeOptions {
  anchor: string;
  /** 2–9 colours, the anchor included. */
  count: number;
  hues: HueMode;
  /** Colours kept as they are, by position; the anchor is position 0. */
  locked?: (string | null)[];
  /**
   * Colours set by hand, by position: whichever of lightness, chroma and hue
   * is given replaces what the settings would make. The anchor has none.
   */
  manual?: (Manual | null)[];
  /** Brings every colour that isn't locked down to the least vivid one. */
  matchChroma: boolean;
  model: SchemeModel;
  /** 0–3 of the companions replaced by tinted greys. */
  neutrals: number;
  /** 0–360°: how far round the wheel the hues reach. */
  spread: number;
}

export interface Manual {
  c?: number;
  h?: number;
  l?: number;
}

export const SCHEME_DEFAULTS: Omit<SchemeOptions, "anchor"> = {
  count: 4,
  hues: "spread",
  matchChroma: false,
  model: "balance",
  neutrals: 0,
  spread: 360,
};

const turn = (h: number) => ((h % 360) + 360) % 360;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** How far each colour's hue sits from the anchor's, anchor first (0). */
export const hueOffsets = (
  count: number,
  hues: HueMode,
  spread: number
): number[] =>
  Array.from({ length: count }, (_, i) => {
    if (i === 0) {
      return 0;
    }
    if (hues === "spread") {
      return (spread * i) / count;
    }
    // Ranked outward from the anchor, alternating sides.
    const rank = Math.ceil(i / 2);
    const side = i % 2 === 1 ? 1 : -1;
    if (hues === "nearby") {
      // A full spread fans a third of the wheel either side.
      const step = spread / 3 / Math.max(1, Math.ceil((count - 1) / 2));
      return side * rank * step;
    }
    // Opposite: odd places cross the wheel, even ones stay; each side fans.
    const fan = (spread / 12) * (rank - 1) * (rank % 2 === 0 ? -1 : 1);
    return (i % 2 === 1 ? 180 : 0) + fan;
  });

/**
 * The lightness a hue is most itself at: yellow high, blue and violet low.
 * Two bumps fitted by eye to where sRGB's most vivid colours sit.
 */
const naturalLightness = (h: number): number => {
  const rad = (turn(h) * Math.PI) / 180;
  return (
    0.66 +
    0.17 * Math.cos(rad - (105 * Math.PI) / 180) +
    0.05 * Math.cos(2 * rad - (20 * Math.PI) / 180)
  );
};

/** Lightness from pale to deep across n places. */
const LIGHT_END = 0.95;
const DARK_END = 0.24;
const stepped = (i: number, n: number) =>
  n <= 1 ? 0.6 : LIGHT_END - ((LIGHT_END - DARK_END) * i) / (n - 1);

/** Less chroma toward white and black, as the gamut narrows. */
const room = (l: number) => Math.sin(Math.PI * clamp(l, 0.02, 0.98)) ** 0.8;

const sequential = (base: Oklch, count: number, spread: number): Oklch[] => {
  const ladder = Array.from({ length: count }, (_, i) => stepped(i, count));
  // The anchor takes the step nearest its own lightness, and keeps it.
  let at = 0;
  for (const [i, l] of ladder.entries()) {
    if (Math.abs(l - base.l) < Math.abs((ladder[at] ?? 0) - base.l)) {
      at = i;
    }
  }
  const peak = base.c / Math.max(0.2, room(base.l));
  // The hue drifts a little along the ramp: a twelfth of the spread, end to end.
  const drift = spread / 12;
  return ladder.map((l, i) =>
    i === at
      ? base
      : {
          a: 1,
          c: peak * room(l),
          h: turn(base.h + (drift * (i - at)) / Math.max(1, count - 1)),
          l,
        }
  );
};

const diverging = (
  base: Oklch,
  count: number,
  hues: HueMode,
  spread: number
): Oklch[] => {
  const far = hues === "opposite" ? 180 : clamp(spread / 2, 30, 180);
  const other = turn(base.h + (hues === "nearby" ? far / 2 : far));
  const mid = (count - 1) / 2;
  const deep = Math.min(base.l, 0.5);
  return Array.from({ length: count }, (_, i) => {
    // 1 at either end, 0 at the centre.
    const t = mid === 0 ? 1 : Math.abs(i - mid) / mid;
    const l = 0.95 - (0.95 - deep) * t;
    return {
      a: 1,
      c: base.c * t ** 0.9,
      h: i <= mid ? base.h : other,
      l,
    };
  });
};

/** One companion, by the model, at its place among the companions. */
const companion = (
  base: Oklch,
  model: SchemeModel,
  h: number,
  place: number,
  places: number
): Oklch => {
  if (model === "adaptive") {
    const l = clamp(
      base.l + (naturalLightness(h) - naturalLightness(base.h)),
      0.3,
      0.92
    );
    return { a: 1, c: base.c * 1.1, h, l };
  }
  if (model === "companion") {
    const shift = (0.1 + 0.05 * Math.floor(place / 2)) * (place % 2 ? -1 : 1);
    return { a: 1, c: base.c * 0.55, h, l: clamp(base.l + shift, 0.25, 0.93) };
  }
  if (model === "composition") {
    // Deep first, pale last: something to set type in, something to set it on.
    const l = places <= 1 ? 0.25 : 0.25 + (0.69 * place) / (places - 1);
    return { a: 1, c: base.c * 0.7 * room(l), h, l };
  }
  return { a: 1, c: base.c, h, l: base.l };
};

/** Tinted greys in the anchor's hue: pale, deep, then mid. */
const NEUTRAL_L = [0.955, 0.25, 0.62];
const neutral = (base: Oklch, i: number): Oklch => ({
  a: 1,
  c: 0.012,
  h: base.h,
  l: NEUTRAL_L[i % NEUTRAL_L.length] ?? 0.6,
});

/** The palette, anchor first (in a ramp, in order from light to dark). */
export const buildScheme = (options: SchemeOptions): string[] => {
  const base = hexToOklch(options.anchor);
  if (!base) {
    return [];
  }
  // The slider stops at 9; a loaded brand palette can be longer.
  const count = Math.round(clamp(options.count, 2, 16));
  const isRamp =
    options.model === "sequential" || options.model === "diverging";
  let colours: Oklch[];
  if (options.model === "sequential") {
    colours = sequential(base, count, options.spread);
  } else if (options.model === "diverging") {
    colours = diverging(base, count, options.hues, options.spread);
  } else {
    const offsets = hueOffsets(count, options.hues, options.spread);
    colours = offsets.map((offset, i) =>
      i === 0
        ? base
        : companion(
            base,
            options.model,
            turn(options.manual?.[i]?.h ?? base.h + offset),
            i - 1,
            count - 1
          )
    );
  }
  // Neutrals take the last companions' places; a ramp has none to give.
  const neutrals = isRamp
    ? 0
    : Math.round(clamp(options.neutrals, 0, Math.min(3, count - 1)));
  const isNeutral = (i: number) => i >= count - neutrals;
  // A colour set by hand takes its own numbers over the model's (and over
  // being a neutral); the anchor is never set this way.
  const hands = colours.map((c, i) =>
    c === base ? null : (options.manual?.[i] ?? null)
  );
  colours = colours.map((c, i) => {
    const hand = hands[i];
    const made = isNeutral(i) ? neutral(base, i - (count - neutrals)) : c;
    if (hand) {
      return toSrgbGamut({ ...made, ...hand, h: turn(hand.h ?? made.h) });
    }
    return isNeutral(i) ? made : toSrgbGamut(c);
  });

  const kept = (i: number) => options.locked?.[i] ?? null;
  if (options.matchChroma) {
    // A chroma set by hand stays as set.
    const free = colours.filter(
      (_, i) => !(isNeutral(i) || kept(i) || typeof hands[i]?.c === "number")
    );
    const lowest = Math.min(...free.map((c) => c.c));
    colours = colours.map((c, i) =>
      isNeutral(i) ||
      kept(i) ||
      typeof hands[i]?.c === "number" ||
      !Number.isFinite(lowest)
        ? c
        : toSrgbGamut({ ...c, c: lowest })
    );
  }
  return colours.map((c, i) => {
    if (kept(i)) {
      return kept(i) as string;
    }
    // The anchor is itself, to the digit, unless matching chroma moved it.
    const untouched = c === base;
    return untouched ? options.anchor.toLowerCase() : oklchToHex(c);
  });
};

/*
 * Colour vision: how a colour looks with one kind of cone missing. The
 * matrices are Viénot, Brettel and Mollon's (1999) for protanopia and
 * deuteranopia and the usual companion for tritanopia, applied in linear
 * light. Good for spotting two colours that collapse into one; not a
 * clinical simulation.
 */
export const VISIONS = [
  { id: "none", label: "Full colour" },
  { id: "protanopia", label: "Protanopia" },
  { id: "deuteranopia", label: "Deuteranopia" },
  { id: "tritanopia", label: "Tritanopia" },
] as const;

export type Vision = (typeof VISIONS)[number]["id"];

const SIM: Record<Exclude<Vision, "none">, number[]> = {
  deuteranopia: [
    0.292_75, 0.707_25, 0, 0.292_75, 0.707_25, 0, -0.022_34, 0.022_34, 1,
  ],
  protanopia: [
    0.108_89, 0.891_11, 0, 0.108_89, 0.891_11, 0, 0.004_47, -0.004_47, 1,
  ],
  tritanopia: [
    1, 0.152_36, -0.152_36, 0, 0.867_17, 0.132_83, 0, 0.867_17, 0.132_83,
  ],
};

const toLinear = (v: number) =>
  v <= 0.040_45 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const toGamma = (v: number) =>
  v <= 0.003_130_8 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;

const HEX6 = /^#[0-9a-f]{6}$/i;

export const simulate = (hex: string, vision: Vision): string => {
  if (vision === "none" || !HEX6.test(hex)) {
    return hex;
  }
  const m = SIM[vision];
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) =>
    toLinear(Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  );
  const out = [0, 3, 6].map((row) =>
    toGamma(
      clamp(
        (m[row] ?? 0) * r + (m[row + 1] ?? 0) * g + (m[row + 2] ?? 0) * b,
        0,
        1
      )
    )
  );
  return `#${out
    .map((v) =>
      Math.round(clamp(v, 0, 1) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
};

/** The smallest step between neighbouring hues round the wheel, in degrees. */
export const hueSpacing = (hues: number[]): number | null => {
  if (hues.length < 2) {
    return null;
  }
  const sorted = [...hues].map(turn).sort((a, b) => a - b);
  const gaps = sorted.map(
    (h, i) => turn((sorted[(i + 1) % sorted.length] ?? 0) - h) || 360
  );
  return Math.round(Math.min(...gaps));
};
