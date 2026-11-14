/**
 * A board's colour variables as they may be stored: a short list of
 * { id, name, value } with a plain six-digit hex value. Anything else is
 * dropped, so one bad entry cannot cost the rest.
 */
export interface ColorVarDto {
  id: string;
  name: string;
  value: string;
}

export const MAX_COLOR_VARS = 40;
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[\w-]{1,64}$/;

export const parseColorVars = (value: unknown): ColorVarDto[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  const out: ColorVarDto[] = [];
  for (const raw of value.slice(0, MAX_COLOR_VARS)) {
    const v = raw as Partial<ColorVarDto> | null;
    if (
      !v ||
      typeof v.id !== "string" ||
      !ID.test(v.id) ||
      seen.has(v.id) ||
      typeof v.value !== "string" ||
      !HEX.test(v.value)
    ) {
      continue;
    }
    seen.add(v.id);
    const name =
      typeof v.name === "string" && v.name.trim()
        ? v.name.trim().slice(0, 40)
        : "Colour";
    out.push({ id: v.id, name, value: v.value.toLowerCase() });
  }
  return out;
};
