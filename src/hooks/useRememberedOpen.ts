import { useState } from "react";

/**
 * Whether one fold-away item is open, remembered in this browser by the
 * item's id, so a reload opens a long editor the way it was left rather
 * than back at its defaults.
 *
 * Every item shares one stored map; the oldest entries drop off past the
 * cap, so it cannot grow without end as items come and go.
 */

const KEY = "admin-open-items";
const MAX_ENTRIES = 600;

const readAll = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
};

/** The remembered state of `id`, or undefined if it was never toggled. */
export const rememberedOpen = (id: string): boolean | undefined =>
  readAll()[id];

export const rememberOpen = (id: string, open: boolean): void => {
  try {
    const all = readAll();
    // Re-inserted at the end, so the map's order is oldest first.
    delete all[id];
    all[id] = open;
    const entries = Object.entries(all);
    localStorage.setItem(
      KEY,
      JSON.stringify(Object.fromEntries(entries.slice(-MAX_ENTRIES)))
    );
  } catch {
    // Private mode: it still folds, it is just not remembered.
  }
};

export const useRememberedOpen = (
  id: string,
  fallback: boolean
): [boolean, (open: boolean) => void] => {
  const [open, setOpen] = useState(() => rememberedOpen(id) ?? fallback);
  const set = (next: boolean) => {
    setOpen(next);
    rememberOpen(id, next);
  };
  return [open, set];
};
