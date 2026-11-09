/**
 * Colour arithmetic for Liquid Gradients: hex in, OKLab out and back.
 *
 * Mixing in OKLab is what keeps a blend clean: half way from blue to yellow
 * is a green, not the grey that mixing the sRGB numbers gives.
 */

const HEX = /^#(?<hex>[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/iu;

export type Triple = [number, number, number];

/** `#rgb`, `#rrggbb` or `#rrggbbaa` as three 0–1 floats (black if neither). */
export const rgbOf = (colour: string): Triple => {
  const raw = colour.trim().match(HEX)?.groups?.hex ?? "000000";
  const full =
    raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw.slice(0, 6);
  return [0, 2, 4].map(
    (at) => Number.parseInt(full.slice(at, at + 2), 16) / 255
  ) as Triple;
};

const linear = (c: number) =>
  c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const gamma = (c: number) => {
  const x = Math.min(1, Math.max(0, c));
  return x <= 0.003_130_8 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
};

/** A colour in OKLab. */
export const oklabOf = (colour: string): Triple => {
  const [r, g, b] = rgbOf(colour).map(linear) as Triple;
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

const hex2 = (c: number) =>
  Math.round(gamma(c) * 255)
    .toString(16)
    .padStart(2, "0");

/** An OKLab colour back as `#rrggbb`, clipped to what sRGB can show. */
export const hexOfOklab = ([L, a, b]: Triple): string => {
  const l = (L + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const m = (L - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const s = (L - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
  return `#${hex2(4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s)}${hex2(-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s)}${hex2(-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s)}`;
};

/** `steps` colours from `from` to `to`, mixed in OKLab, both ends included. */
export const rampBetween = (
  from: string,
  to: string,
  steps: number
): string[] => {
  const a = oklabOf(from);
  const b = oklabOf(to);
  return Array.from({ length: steps }, (_, i) => {
    const t = steps > 1 ? i / (steps - 1) : 0;
    return hexOfOklab([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]);
  });
};

/** A number from a setting, or the fallback when it isn't one. */
export const numberOr = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
