import type { BoardItem } from "../../types";

/**
 * Colour variables: named colours kept on the board. A layer uses one by
 * having its colour; changing the variable changes that colour wherever it
 * is on the board (text, shapes, tints, frames, component instances, Studio
 * recipes), keeping each use's own transparency.
 *
 * Matched by colour rather than by a stored link, so a duplicated layer, a
 * component, a pasted frame or a Studio setting all follow the variable
 * without anything having to remember them.
 */
export interface ColorVar {
  id: string;
  name: string;
  /** `#rrggbb`. */
  value: string;
}

const SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
/** A hex colour inside any string: a value, a comma list, a gradient. */
const ANY_HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])/gi;

/** `#rrggbb` or `#rrggbbaa`, lower case; null for anything else. */
export const normalHex = (value: string): string | null => {
  const v = value.trim();
  const short = SHORT.exec(v);
  if (short) {
    return `#${short
      .slice(1, 4)
      .map((c) => c + c)
      .join("")}`.toLowerCase();
  }
  return LONG.test(v) ? v.toLowerCase() : null;
};

/** The colour without its transparency: `#rrggbb`. */
export const rgbOf = (value: string): string | null =>
  normalHex(value)?.slice(0, 7) ?? null;

/** The variable a colour is, ignoring transparency. */
export const varFor = (value: string, vars: ColorVar[]): ColorVar | null => {
  const rgb = rgbOf(value);
  return rgb ? (vars.find((v) => rgbOf(v.value) === rgb) ?? null) : null;
};

/** Every use of `from` in a string turned into `to`, keeping its alpha. */
export const recolourString = (s: string, from: string, to: string): string =>
  s.replace(ANY_HEX, (hex) => {
    const n = normalHex(hex);
    return n && n.slice(0, 7) === from ? to + n.slice(7) : hex;
  });

const recolourDeep = (value: unknown, from: string, to: string): unknown => {
  if (typeof value === "string") {
    return value.includes("#") ? recolourString(value, from, to) : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => recolourDeep(v, from, to));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, recolourDeep(v, from, to)])
    );
  }
  return value;
};

/** A value with `from` swapped for `to` throughout, or the same value. */
export const recoloured = <T>(value: T, from: string, to: string): T => {
  const a = rgbOf(from);
  const b = rgbOf(to);
  if (!(a && b) || a === b) {
    return value;
  }
  const next = recolourDeep(value, a, b) as T;
  return JSON.stringify(next) === JSON.stringify(value) ? value : next;
};

/**
 * The board with one colour changed for another wherever a layer uses it:
 * its text style and its settings (fills, strokes, tints, a frame's ground,
 * an instance's properties, a Studio recipe). The ids changed come back too.
 */
export const recolourItems = (
  items: BoardItem[],
  from: string,
  to: string
): { changed: string[]; items: BoardItem[] } => {
  const changed: string[] = [];
  const next = items.map((item) => {
    const textStyle = recoloured(item.textStyle ?? null, from, to);
    const config = recoloured(item.config, from, to);
    if (textStyle === (item.textStyle ?? null) && config === item.config) {
      return item;
    }
    changed.push(item.id);
    return { ...item, config, textStyle };
  });
  return { changed, items: changed.length > 0 ? next : items };
};

const MAX_NAME = 40;

/** A tidy name: trimmed, short, and not already taken. */
export const nameFor = (wanted: string, vars: ColorVar[]): string => {
  const base = wanted.trim().slice(0, MAX_NAME) || "Colour";
  const taken = new Set(vars.map((v) => v.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) {
    n += 1;
  }
  return `${base} ${n}`;
};
