import { useSyncExternalStore } from "react";
import {
  cleanConcept,
  type ReviewConcept,
} from "../../../config/reviewConcept.js";

/**
 * One concept held for pasting: copied from any note and pasted into
 * another as a concept, or into a sequence as its steps. Kept in this
 * browser (localStorage), so it survives moving between reviews and reloads,
 * and cleaned on the way out like anything read back.
 */

const KEY = "review-concept-clipboard";
const listeners = new Set<() => void>();

const read = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const copyConcept = (concept: ReviewConcept) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(concept));
  } catch {
    // Storage full or off: nothing to paste, which the button will show.
  }
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

/** The held concept, or null; updates when another note copies one. */
export const useCopiedConcept = (): ReviewConcept | null => {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  if (!raw) {
    return null;
  }
  try {
    return cleanConcept(JSON.parse(raw));
  } catch {
    return null;
  }
};
