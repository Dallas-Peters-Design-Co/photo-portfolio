import type {
  LightnessRamp,
  PaletteEntry,
} from "../../../../config/brandKit.js";
import { paletteIds } from "../../../../config/paletteBinding.js";
import { oklchToHex, toSrgbGamut } from "../../../lib/oklch";
import type { Lch } from "./SchemeDials";
import { STATUS_ROLES } from "./schemeRoles";

export interface Member extends Lch {
  group: string;
  ramp?: LightnessRamp;
}

export interface Arrangement {
  members: Record<number, Member>;
  names: Record<number, string>;
  order: number[];
  // Destination variable IDs in generator-slot order, even after the bar moves.
  targetIds: Record<string, string[]>;
}

export const emptyArrangement = (): Arrangement => ({
  members: {},
  names: {},
  order: [],
  targetIds: {},
});

export function swatchOrder(count: number, saved: number[]) {
  const slots = Array.from({ length: count }, (_, i) => i);
  return [...new Set([...saved.filter((i) => slots.includes(i)), ...slots])];
}

/** Derive steps from visible group members in bar order. Locked slots keep their place. */
export function spreadMembers(
  members: Record<number, Member>,
  order: number[]
) {
  const groups = new Map<string, number[]>();
  const result = { ...members };
  for (const i of order) {
    const member = members[i];
    if (!member?.ramp) {
      continue;
    }
    const slots = groups.get(member.group) ?? [];
    slots.push(i);
    groups.set(member.group, slots);
  }
  for (const slots of groups.values()) {
    for (const [position, i] of slots.entries()) {
      const member = members[i];
      const { ramp } = member;
      if (!ramp) {
        continue;
      }
      const t = slots.length === 1 ? 0.5 : position / (slots.length - 1);
      result[i] = {
        ...member,
        c: ramp.c,
        h: ramp.h,
        l: ramp.min + t * (ramp.max - ramp.min),
      };
    }
  }
  return result;
}

/** Fit each group to the chroma every member can display at its own hue. */
export function alignedColors(
  colors: string[],
  members: Record<number, Member>,
  locked: (string | null)[]
) {
  const limits = new Map<string, number>();
  for (const [i] of colors.entries()) {
    const member = members[i];
    if (!member || member.ramp || locked[i]) {
      continue;
    }
    const fit = toSrgbGamut({ ...member, a: 1 });
    limits.set(
      member.group,
      Math.min(limits.get(member.group) ?? fit.c, fit.c)
    );
  }
  return colors.map((hex, i) => {
    const m = members[i];
    return m && !locked[i]
      ? oklchToHex({
          ...m,
          a: 1,
          c: m.ramp ? m.c : (limits.get(m.group) ?? m.c),
        })
      : hex;
  });
}

export function arrangedPalette(
  target: PaletteEntry[],
  source: PaletteEntry[],
  roles: Record<number, string>,
  draft: Arrangement,
  kitId: string,
  transfer: boolean
) {
  const ids = paletteIds(target);
  const prior = draft.targetIds[kitId] ?? [];
  const used = new Set<number>();
  const slots = source.map((_, i) => ids.indexOf(prior[i]));
  for (const slot of slots) {
    if (slot >= 0) {
      used.add(slot);
    }
  }
  for (const [i, entry] of source.entries()) {
    const role = (roles[i] ?? entry.role).toLowerCase();
    if (slots[i] >= 0 || !transfer || !STATUS_ROLES.includes(role)) {
      continue;
    }
    const match = target.findIndex(
      (t, j) => !used.has(j) && t.role.toLowerCase() === role
    );
    if (match >= 0) {
      used.add(match);
      slots[i] = match;
    }
  }
  let cursor = 0;
  const entries = source.map((entry, i) => {
    while (used.has(cursor)) {
      cursor += 1;
    }
    const slot = slots[i] >= 0 ? slots[i] : cursor;
    used.add(slot);
    const had = target[slot];
    const group = draft.members[i]?.group;
    return {
      ...(group ? { group } : {}),
      ...(draft.members[i]?.ramp ? { ramp: draft.members[i].ramp } : {}),
      id: ids[slot] ?? crypto.randomUUID(),
      name: draft.names[i] ?? (had?.name || entry.name),
      role: roles[i] ?? (had?.role || entry.role),
      value: entry.value,
    };
  });
  const tail = target.flatMap((entry, i) =>
    used.has(i) ? [] : [{ ...entry, id: ids[i] }]
  );
  return {
    ids: entries.map((e) => e.id),
    palette: [
      ...swatchOrder(entries.length, draft.order).map((i) => entries[i]),
      ...tail,
    ],
  };
}
