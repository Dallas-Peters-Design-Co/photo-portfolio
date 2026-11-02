/**
 * Recolouring by remapping, the way Illustrator's Recolor Artwork works: the
 * picture's colours are boiled down to a few main ones, each is listed with a
 * colour to replace it, and every tile takes the replacement for whichever
 * main colour it is closest to.
 *
 * The main colours come from k-means over the mosaic's own tiles, seeded
 * from brightness quantiles so the same picture gives the same colours every
 * time (a random start would reshuffle the list as you work). They're listed
 * dark to light, and the replacements are kept by position in that list.
 */

export type Rgb = [number, number, number];

export const hex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((n) =>
      Math.round(Math.min(255, Math.max(0, n)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;

export const rgb = (h: string): Rgb => {
  const full =
    h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map(
    (i) => Number.parseInt(full.slice(i, i + 2), 16) || 0
  );
  return [r, g, b];
};

/** Perceived brightness, 0 to 255. */
export const luma = (r: number, g: number, b: number): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

const distance = (a: Rgb, b: Rgb) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Which of the colours a pixel is closest to. */
export const closest = (pixel: Rgb, colours: Rgb[]): number => {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  colours.forEach((c, i) => {
    const d = distance(pixel, c);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
};

const ROUNDS = 10;

/** The `count` main colours of RGBA pixel data, dark to light. */
export const mainColours = (data: Uint8ClampedArray, count: number): Rgb[] => {
  const pixels: Rgb[] = [];
  for (let i = 0; i + 2 < data.length; i += 4) {
    pixels.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
  }
  if (pixels.length === 0) {
    return [];
  }
  const sorted = [...pixels].sort((a, b) => luma(...a) - luma(...b));
  const k = Math.max(1, Math.min(count, pixels.length));
  let centres: Rgb[] = Array.from(
    { length: k },
    (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)] ?? [0, 0, 0]
  );
  for (let round = 0; round < ROUNDS; round += 1) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const p of pixels) {
      const s = sums[closest(p, centres)];
      if (s) {
        s[0] += p[0];
        s[1] += p[1];
        s[2] += p[2];
        s[3] += 1;
      }
    }
    // A colour no tile is nearest to keeps its place rather than vanishing,
    // so the list (and the replacements set against it) stays put.
    centres = centres.map((c, i) => {
      const [r = 0, g = 0, b = 0, n = 0] = sums[i] ?? [];
      return n > 0 ? [r / n, g / n, b / n] : c;
    });
  }
  // Two starting points can settle on the same colour; list it once.
  const unique = new Map(centres.map((c) => [hex(...c), c]));
  return [...unique.values()].sort((a, b) => luma(...a) - luma(...b));
};

/** #rgb, #rrggbb, or #rrggbbaa for a colour with transparency. */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * The replacements, stored comma-joined by position; an empty place keeps
 * that colour as it is.
 */
export const replacementsOf = (value: unknown, count: number): string[] => {
  const parts = typeof value === "string" ? value.split(",") : [];
  return Array.from({ length: count }, (_, i) => {
    const part = (parts[i] ?? "").trim();
    return HEX.test(part) ? part : "";
  });
};

/** Each tile's fill: the replacement for its nearest main colour. */
export const remapper = (
  colours: Rgb[],
  replacements: string[]
): ((r: number, g: number, b: number) => string) => {
  const fills = colours.map((c, i) => replacements[i] || hex(...c));
  return (r, g, b) => fills[closest([r, g, b], colours)] ?? hex(r, g, b);
};
