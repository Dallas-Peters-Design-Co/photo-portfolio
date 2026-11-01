// biome-ignore-all lint/suspicious/noBitwiseOperators: a seeded PRNG is bit arithmetic by definition
/** A small seeded random generator (mulberry32), so a seed redraws the same art. */
export const rng = (seed: number): (() => number) => {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d_2b_79_f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

export const newSeed = (): number => Math.floor(Math.random() * 1_000_000);

/** Two decimals: enough for any SVG coordinate, and much shorter files. */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

export const esc = (s: string): string =>
  s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Picks the n-th colour of a palette, wrapping. */
export const pick = (palette: string[], i: number): string =>
  palette[((i % palette.length) + palette.length) % palette.length] ??
  "#000000";

export const svgDoc = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
