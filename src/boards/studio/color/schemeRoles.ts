import type { PaletteEntry } from "../../../../config/brandKit.js";
import { paletteIds } from "../../../../config/paletteBinding.js";

import { keepPaletteNames } from "./keepPaletteNames";

export const STATUS_ROLES = ["success", "info", "danger", "warning"];

export function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Keep authored kit names. On transfer, match status colours by role first. */
export function schemePalette(
  target: PaletteEntry[],
  source: PaletteEntry[],
  edits: Record<number, string>,
  transfer: boolean
): PaletteEntry[] {
  if (
    Object.keys(edits).length === 0 &&
    !(
      transfer &&
      source.some((entry) => STATUS_ROLES.includes(entry.role.toLowerCase()))
    )
  ) {
    return keepPaletteNames(
      target,
      source.map((entry) => entry.value),
      source
    );
  }
  const ids = paletteIds(target);
  const result = [...target];
  const used = new Set<number>();
  const slots = source.map((entry, i) => {
    const role = (edits[i] ?? entry.role).toLowerCase();
    if (transfer && STATUS_ROLES.includes(role)) {
      const slot = target.findIndex(
        (t, j) => !used.has(j) && t.role.toLowerCase() === role
      );
      if (slot >= 0) {
        used.add(slot);
        return slot;
      }
    }
    return -1;
  });
  let next = 0;
  for (const [i, entry] of source.entries()) {
    while (used.has(next)) {
      next += 1;
    }
    const slot = slots[i] === -1 ? next : slots[i];
    used.add(slot);
    const had = target[slot];
    const incoming = edits[i] ?? entry.role;
    const role =
      edits[i] ??
      (transfer && STATUS_ROLES.includes(incoming.toLowerCase())
        ? incoming
        : had?.role || incoming);
    const name = had?.name || entry.name || roleLabel(role);
    result[slot] = {
      ...(had && (had.id || role !== had.role || name !== had.name)
        ? { id: ids[slot] }
        : {}),
      ...had,
      name,
      role,
      value: entry.value,
    };
  }
  const values = new Set(source.map((entry) => entry.value.toLowerCase()));
  return result.filter(
    (entry, i) =>
      used.has(i) || entry.role || !values.has(entry.value.toLowerCase())
  );
}
