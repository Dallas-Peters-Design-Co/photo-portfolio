import type { PaletteEntry } from "../../../../config/brandKit.js";
import { paletteIds } from "../../../../config/paletteBinding.js";

/**
 * New colours saved into a kit's palette, the kit keeping its names.
 *
 * A palette's names and roles are what the kit's styles and components are
 * written against ("Primary" is the button colour), so a save changes the
 * colours and keeps those: each place keeps the name and role it had.
 * `loaded` (the entries the colours came from, maybe another kit's) only
 * names a place the kit had nothing in. Colours the kit had past the end of
 * the new ones stay too, unless one of the new colours is the same.
 */
export const keepPaletteNames = (
  target: PaletteEntry[],
  values: string[],
  loaded?:
    | ({ group?: string; name?: string; role?: string } | null | undefined)[]
    | null
): PaletteEntry[] => {
  const ids = paletteIds(target);
  const next = values.map((raw, i) => {
    const value = raw.toLowerCase();
    const had = target[i];
    const from = loaded?.[i];
    const name = had?.name || from?.name || "";
    const role = had?.role || from?.role || "";
    return {
      ...(had && (had.id || had.name !== name || had.role !== role)
        ? { id: ids[i] }
        : {}),
      ...((had?.group ?? from?.group)
        ? { group: had?.group ?? from?.group }
        : {}),
      name,
      role,
      value,
    };
  });
  const taken = new Set(next.map((entry) => entry.value));
  return [
    ...next,
    ...target.slice(values.length).filter((entry) => !taken.has(entry.value)),
  ];
};
