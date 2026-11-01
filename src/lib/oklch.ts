/**
 * OKLCH ⇄ sRGB hex, for the colour pickers.
 *
 * Pickers work in OKLCH (lightness, chroma, hue), where equal steps look like
 * equal changes, and hand back hex so every stored colour stays a plain value
 * every renderer, export and validator already understands. A colour outside
 * sRGB is brought in by lowering chroma at the same lightness and hue, which
 * is how CSS Color 4 gamut-maps.
 *
 * Maths after Björn Ottosson's OKLab.
 */

export interface Oklch {
  /** 0–1 */
  a: number;
  /** 0 to about 0.37 */
  c: number;
  /** 0–360 */
  h: number;
  /** 0–1 */
  l: number;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const OKLCH =
  /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/i;

const toLinear = (c: number) =>
  c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c: number) =>
  c <= 0.003_130_8 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

const parseHex = (hex: string): [number, number, number, number] | null => {
  const [, digits] = HEX.exec(hex.trim()) ?? [];
  if (!digits) {
    return null;
  }
  const h =
    digits.length <= 4 ? [...digits].map((ch) => ch + ch).join("") : digits;
  const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16) / 255;
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 1];
};

export const hexToOklch = (hex: string): Oklch | null => {
  const rgb = parseHex(hex);
  if (!rgb) {
    return null;
  }
  const [r, g, b] = rgb.slice(0, 3).map(toLinear) as [number, number, number];
  const l_ = Math.cbrt(
    0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b
  );
  const m_ = Math.cbrt(
    0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b
  );
  const s_ = Math.cbrt(
    0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b
  );
  const L = 0.210_454_255_3 * l_ + 0.793_617_785 * m_ - 0.004_072_046_8 * s_;
  const A = 1.977_998_495_1 * l_ - 2.428_592_205 * m_ + 0.450_593_709_9 * s_;
  const B = 0.025_904_037_1 * l_ + 0.782_771_766_2 * m_ - 0.808_675_766 * s_;
  const c = Math.sqrt(A * A + B * B);
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { a: rgb[3], c: c < 1e-4 ? 0 : c, h: c < 1e-4 ? 0 : h, l: L };
};

/** Linear sRGB for an OKLCH colour; may fall outside 0–1. */
const oklchToLinear = ({ c, h, l }: Oklch): [number, number, number] => {
  const rad = (h * Math.PI) / 180;
  const A = c * Math.cos(rad);
  const B = c * Math.sin(rad);
  const l_ = (l + 0.396_337_777_4 * A + 0.215_803_757_3 * B) ** 3;
  const m_ = (l - 0.105_561_345_8 * A - 0.063_854_172_8 * B) ** 3;
  const s_ = (l - 0.089_484_177_5 * A - 1.291_485_548 * B) ** 3;
  return [
    4.076_741_662_1 * l_ - 3.307_711_591_3 * m_ + 0.230_969_929_2 * s_,
    -1.268_438_004_6 * l_ + 2.609_757_401_1 * m_ - 0.341_319_396_5 * s_,
    -0.004_196_086_3 * l_ - 0.703_418_614_7 * m_ + 1.707_614_701 * s_,
  ];
};

const EPS = 1e-4;
const inGamut = (rgb: number[]) => rgb.every((v) => v >= -EPS && v <= 1 + EPS);

export const isInSrgb = (color: Oklch): boolean =>
  inGamut(oklchToLinear(color));

/** The colour with chroma lowered just enough to fit sRGB. */
export const toSrgbGamut = (color: Oklch): Oklch => {
  if (isInSrgb(color)) {
    return color;
  }
  let lo = 0;
  let hi = color.c;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (isInSrgb({ ...color, c: mid })) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { ...color, c: lo };
};

const byte = (v: number) =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, "0");

/** `#rrggbb`, or `#rrggbbaa` when not fully opaque. */
export const oklchToHex = (color: Oklch): string => {
  const fitted = toSrgbGamut({
    ...color,
    l: Math.min(1, Math.max(0, color.l)),
  });
  const [r, g, b] = oklchToLinear(fitted).map(toGamma) as [
    number,
    number,
    number,
  ];
  const alpha = color.a >= 0.999 ? "" : byte(color.a);
  return `#${byte(r)}${byte(g)}${byte(b)}${alpha}`;
};

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/** As CSS writes it: `oklch(62.4% 0.181 255.3)`, with `/ alpha` when < 1. */
export const formatOklch = ({ a, c, h, l }: Oklch): string =>
  `oklch(${round(l * 100, 1)}% ${round(c, 3)} ${round(h, 1)}${a < 0.999 ? ` / ${round(a, 2)}` : ""})`;

/** Reads `oklch(...)` or a hex value; null for anything else. */
export const parseColor = (text: string): Oklch | null => {
  const m = OKLCH.exec(text.trim());
  if (m) {
    const lRaw = Number(m[1]);
    const alphaRaw = m[5] === undefined ? 1 : Number(m[5]);
    return {
      a: Math.min(1, Math.max(0, m[6] ? alphaRaw / 100 : alphaRaw)),
      c: Math.max(0, Number(m[3])),
      h: Number(m[4]) % 360,
      l: Math.min(1, Math.max(0, m[2] || lRaw > 1 ? lRaw / 100 : lRaw)),
    };
  }
  return hexToOklch(text);
};
