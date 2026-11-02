import type { StudioParam, StudioValues } from "./types";

const HEX = /^#[0-9a-f]{3,8}$/i;

/** The colours a "colors" setting holds, or the brand's first few. */
export const colorsOf = (
  value: unknown,
  palette: string[],
  count: number
): string[] => {
  const picked =
    typeof value === "string"
      ? value.split(",").filter((c) => HEX.test(c.trim()))
      : [];
  if (picked.length > 0) {
    return picked.map((c) => c.trim());
  }
  return Array.from(
    { length: Math.min(count, Math.max(palette.length, 1)) },
    (_, i) => palette[i % palette.length] ?? "#000000"
  );
};

/** The palette a tool should draw with: its own picked colours, if it has any. */
export const paletteFor = (
  params: StudioParam[],
  values: StudioValues,
  palette: string[]
): string[] => {
  const param = params.find((p) => p.type === "colors");
  return param && param.type === "colors"
    ? colorsOf(values[param.key], palette, param.count)
    : palette;
};
