import { hexToOklch, oklchToHex, toSrgbGamut } from "../../../lib/oklch";

/**
 * Palettes, after Coolors: generate a set, keep the colours you like locked,
 * generate again around them. Hues come from a colour-wheel harmony anchored on
 * the first locked colour (or a random hue); lightness is spread so a palette
 * always has a light, a dark and something between.
 */

export const HARMONIES = [
  { label: "Any", value: "random" },
  { label: "Analogous", value: "analogous" },
  { label: "Complementary", value: "complementary" },
  { label: "Split complementary", value: "split" },
  { label: "Triadic", value: "triadic" },
  { label: "Tetradic", value: "tetradic" },
  { label: "Monochrome", value: "monochrome" },
] as const;

export type Harmony = (typeof HARMONIES)[number]["value"];

const OFFSETS: Record<Exclude<Harmony, "random">, number[]> = {
  analogous: [0, 25, -25, 50, -50],
  complementary: [0, 180, 15, 195, -15],
  monochrome: [0],
  split: [0, 150, 210, 15, 165],
  tetradic: [0, 90, 180, 270],
  triadic: [0, 120, 240],
};

/** Fisher–Yates on a copy. */
const shuffled = <T>(items: T[], rand: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
};

/**
 * A palette of `slots.length` colours; a slot holding a colour is locked and
 * comes back unchanged.
 */
export const generatePalette = (
  slots: (string | null)[],
  harmony: Harmony,
  rand: () => number
): string[] => {
  const anchor = slots.map((s) => (s ? hexToOklch(s) : null)).find(Boolean);
  const baseHue = anchor ? anchor.h : rand() * 360;
  const free = slots.filter((s) => !s).length;
  // Lightness spread across the free slots, then shuffled into place.
  const lights = shuffled(
    Array.from({ length: free }, (_, i) => {
      const t = free === 1 ? 0.5 : i / (free - 1);
      return 0.22 + t * 0.72 + (rand() - 0.5) * 0.06;
    }),
    rand
  );
  let n = 0;
  return slots.map((slot) => {
    if (slot) {
      return slot;
    }
    const k = n;
    n += 1;
    const l = lights[k] ?? 0.6;
    const offsets = harmony === "random" ? null : OFFSETS[harmony];
    const h = offsets
      ? baseHue + (offsets[k % offsets.length] ?? 0) + (rand() - 0.5) * 10
      : rand() * 360;
    // Very light and very dark colours read as neutrals; keep their chroma low.
    const room = Math.sin(Math.PI * l);
    const c =
      harmony === "monochrome"
        ? (anchor?.c ?? 0.12) * room
        : (0.04 + rand() * 0.16) * room;
    return oklchToHex(toSrgbGamut({ a: 1, c, h: (h + 360) % 360, l }));
  });
};

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

type Rgb = [number, number, number];

const nearestCentre = (p: Rgb, centres: Rgb[]) => {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (const [i, c] of centres.entries()) {
    const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
};

/**
 * The main colours among the pixels: k-means, started from pixels spread
 * through the list, light to dark in the result.
 */
export const mainColors = (px: Rgb[], count: number): string[] => {
  if (px.length === 0) {
    return [];
  }
  const step = Math.max(1, Math.floor(px.length / count));
  let centres: Rgb[] = Array.from({ length: count }, (_, i) => {
    const [r, g, b] = px[Math.min(px.length - 1, i * step)] ?? [0, 0, 0];
    return [r, g, b];
  });
  for (let round = 0; round < 12; round += 1) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      const s = sums[nearestCentre(p, centres)] ?? [];
      s[0] = (s[0] ?? 0) + p[0];
      s[1] = (s[1] ?? 0) + p[1];
      s[2] = (s[2] ?? 0) + p[2];
      s[3] = (s[3] ?? 0) + 1;
    }
    centres = centres.map((c, i) => {
      const [r = 0, g = 0, b = 0, n = 0] = sums[i] ?? [];
      return n > 0 ? [r / n, g / n, b / n] : c;
    });
  }
  return [...new Set(centres.map(([r, g, b]) => hex(r, g, b)))].sort(
    (x, y) => (hexToOklch(y)?.l ?? 0) - (hexToOklch(x)?.l ?? 0)
  );
};

/** The picture's main colours, from a 64px copy of it. */
export const paletteFromImage = (
  image: CanvasImageSource,
  count: number
): string[] => {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return [];
  }
  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const px: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) > 128) {
      px.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
    }
  }
  return mainColors(px, count);
};

/** Black or white, whichever reads on the colour. */
export const inkOn = (color: string): string =>
  (hexToOklch(color)?.l ?? 0) > 0.62 ? "#111111" : "#ffffff";
