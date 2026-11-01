import { hexToOklch, oklchToHex, toSrgbGamut } from "../../../lib/oklch";

/**
 * Tints and shades, 50 to 950, after Color Ramp Generator: each step is the
 * base colour at a set OKLCH lightness, so a 300 in one ramp is as light as a
 * 300 in the next. The base colour keeps its own value at the step nearest its
 * lightness, chroma eases off toward white and black the way pigment does,
 * and hue can drift (warmer lights, cooler darks) by a few degrees.
 */

export const STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

/** Lightness per step, the scale every ramp shares. */
const LIGHTNESS = [
  0.975, 0.94, 0.885, 0.81, 0.72, 0.63, 0.54, 0.45, 0.37, 0.29, 0.21,
];

export interface Ramp {
  /** Which step is the base colour itself. */
  baseIndex: number;
  colors: string[];
  name: string;
}

export interface RampOptions {
  /** Degrees the lightest step turns from the base; the darkest turns back. */
  hueShift: number;
  /** 0–2: chroma relative to the base. */
  saturation: number;
}

const nearestStep = (l: number) => {
  let best = 0;
  for (const [i, v] of LIGHTNESS.entries()) {
    if (Math.abs(v - l) < Math.abs((LIGHTNESS[best] ?? 0) - l)) {
      best = i;
    }
  }
  return best;
};

/** How much chroma a lightness can carry, relative to the middle of the scale. */
const chromaRoom = (l: number) => Math.sin(Math.PI * Math.min(0.98, l)) ** 1.2;

export const rampOf = (
  hex: string,
  name: string,
  { hueShift, saturation }: RampOptions
): Ramp | null => {
  const base = hexToOklch(hex);
  if (!base) {
    return null;
  }
  const baseIndex = nearestStep(base.l);
  const baseRoom = Math.max(0.15, chromaRoom(base.l));
  const colors = LIGHTNESS.map((l, i) => {
    if (i === baseIndex && saturation === 1 && hueShift === 0) {
      return hex.toLowerCase();
    }
    // −1 at the lightest step, +1 at the darkest, 0 at the base.
    const t =
      i < baseIndex
        ? -(baseIndex - i) / baseIndex || 0
        : (i - baseIndex) / (LIGHTNESS.length - 1 - baseIndex) || 0;
    const c = Math.min(
      0.37,
      ((base.c * chromaRoom(l)) / baseRoom) * saturation
    );
    const h = (base.h - t * hueShift + 360) % 360;
    return oklchToHex(toSrgbGamut({ a: 1, c, h, l }));
  });
  return { baseIndex, colors, name };
};

const SLUG = /[^a-z0-9]+/g;
const EDGES = /^-|-$/g;

export const slug = (name: string, fallback: string) =>
  name.toLowerCase().replace(SLUG, "-").replace(EDGES, "") || fallback;

/** CSS custom properties, which Tailwind v4's @theme reads as-is. */
export const rampsCss = (ramps: Ramp[], wrap: "root" | "theme"): string => {
  const lines = ramps.flatMap((r) =>
    r.colors.map((c, i) => `  --color-${r.name}-${STEPS[i]}: ${c};`)
  );
  return `${wrap === "theme" ? "@theme" : ":root"} {\n${lines.join("\n")}\n}\n`;
};

export const rampsJson = (ramps: Ramp[]): string =>
  JSON.stringify(
    Object.fromEntries(
      ramps.map((r) => [
        r.name,
        Object.fromEntries(r.colors.map((c, i) => [STEPS[i], c])),
      ])
    ),
    null,
    2
  );
