import type { PaletteEntry } from "./brandKit.js";

export const PALETTE_ID = /^[a-z0-9-]{1,64}$/;
const TOKEN = /^var\(--kit-([a-z0-9-]{1,120}), (#[\da-f]{6}(?:[\da-f]{2})?)\)$/;
export const paletteToken = (id: string, hex: string) =>
  `var(--kit-${id}, ${hex.toLowerCase()})`;
export const parsePaletteToken = (value: string) => TOKEN.exec(value);
export const paintFallback = (value: string) =>
  parsePaletteToken(value)?.[2] ?? value;

/** Legacy palettes have no ids. Derive one without using the changing colour. */
export function paletteIds(entries: PaletteEntry[]): string[] {
  const used = new Set(entries.flatMap((e) => (e.id ? [e.id] : [])));
  return entries.map((entry) => {
    if (entry.id) {
      return entry.id;
    }
    const name = JSON.stringify([entry.role, entry.name]);
    let hash = 0;
    for (const c of name) {
      hash = (hash * 31 + c.charCodeAt(0)) % 4_294_967_291;
    }
    const base = hash.toString(36);
    let id = base;
    for (let n = 2; used.has(id); n += 1) {
      id = `${base}-${n}`;
    }
    used.add(id);
    return id;
  });
}

const paint =
  /(?:color|background|fill|stroke|foreground|highlight|outline|tint)$/i;

/** Refresh the portable fallback while retaining the binding for the next edit. */
export function mapPalettePaints<T>(
  doc: T,
  replace: (value: string) => string
): T {
  function walk(value: unknown): unknown {
    if (!value || typeof value !== "object") {
      return value;
    }
    if (Array.isArray(value)) {
      const next = value.map(walk);
      return next.some((v, i) => v !== value[i]) ? next : value;
    }
    let changed: Record<string, unknown> | undefined;
    for (const [key, item] of Object.entries(value)) {
      const next =
        typeof item === "string" && paint.test(key)
          ? replace(item)
          : walk(item);
      if (next !== item) {
        changed ??= { ...value };
        changed[key] = next;
      }
    }
    return changed ?? value;
  }
  return walk(doc) as T;
}

export function refreshPalettePaints<T>(doc: T, entries: PaletteEntry[]): T {
  if (!entries.length) {
    return doc;
  }
  const colors = new Map(
    paletteIds(entries).map((id, i) => [id, entries[i].value])
  );
  return mapPalettePaints(doc, (value) => {
    const match = parsePaletteToken(value);
    const hex = match && colors.get(match[1]);
    return hex ? paletteToken(match[1], hex) : value;
  });
}

export function paletteProperties(
  entries: PaletteEntry[] = [],
  prefix = ""
): Record<`--kit-${string}`, string> {
  return Object.fromEntries(
    paletteIds(entries).map((id, i) => [
      `--kit-${prefix}${id}`,
      entries[i].value,
    ])
  );
}
