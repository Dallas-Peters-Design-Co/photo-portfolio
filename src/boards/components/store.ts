import { useSyncExternalStore } from "react";
import { type BrandComponent, withUniqueLids } from "./model";

/**
 * The component definitions this page knows, by id: the ones a loaded board
 * places (sent with the board), and the ones the frame editor lists or saves.
 * Instances are drawn from here, so saving a component redraws every instance
 * on the page at once.
 */

const defs = new Map<string, BrandComponent>();
const listeners = new Set<() => void>();
let version = 0;

export const rememberComponents = (list: BrandComponent[] | undefined) => {
  let changed = false;
  for (const def of list ?? []) {
    if (defs.get(def.id)?.updatedAt !== def.updatedAt) {
      defs.set(def.id, withUniqueLids(def));
      changed = true;
    }
  }
  if (changed) {
    version += 1;
    for (const fn of listeners) {
      fn();
    }
  }
};

export const componentById = (id: string): BrandComponent | null =>
  defs.get(id) ?? null;

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Re-renders when any definition changes; returns the lookup. */
export const useComponentDefs = (): ((id: string) => BrandComponent | null) => {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version
  );
  return componentById;
};
