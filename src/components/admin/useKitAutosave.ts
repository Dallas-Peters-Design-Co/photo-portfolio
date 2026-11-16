import { useCallback, useEffect, useRef, useState } from "react";
import { type BrandKitDoc, sanitizeKitDoc } from "../../../config/brandKit.js";
import { type BrandKit, brandKitsApi } from "../../services/brandKitService";

/** How long edits pause before the kit saves itself. */
const AUTOSAVE_MS = 1200;

export type KitSaveState = "saved" | "unsaved" | "saving" | "failed";

const printOf = (doc: BrandKitDoc, name: string): string =>
  JSON.stringify([sanitizeKitDoc(doc), name.trim()]);

/**
 * The kit saves itself a moment after each change, and once more on the way
 * out, so there is no Save button to forget. The server folds these saves
 * into the kit's working version (api/_lib/brandKitStore.ts writeKitEdit),
 * so the history still reads as versions rather than keystrokes.
 *
 * Saves run one after another: a change made while one is in flight is
 * saved by the next, never raced against it.
 */
export const useKitAutosave = ({
  doc,
  kit,
  name,
  onSaved,
}: {
  doc: BrandKitDoc;
  kit: BrandKit;
  name: string;
  onSaved: () => void;
}) => {
  const [state, setState] = useState<KitSaveState>("saved");
  const saved = useRef({ name: kit.name, print: printOf(kit.doc, kit.name) });
  const latest = useRef({ doc, name });
  latest.current = { doc, name };
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const notify = useRef(onSaved);
  notify.current = onSaved;

  const run = useCallback(async (): Promise<boolean> => {
    const { doc: next, name: nextName } = latest.current;
    const print = printOf(next, nextName);
    if (print === saved.current.print) {
      return true;
    }
    setState("saving");
    try {
      const trimmed = nextName.trim();
      if (trimmed && trimmed !== saved.current.name) {
        await brandKitsApi.rename(kit.id, trimmed);
      }
      await brandKitsApi.save(kit.id, sanitizeKitDoc(next), {
        autosave: true,
      });
      saved.current = { name: trimmed || saved.current.name, print };
      const { doc: now, name: nowName } = latest.current;
      setState(printOf(now, nowName) === print ? "saved" : "unsaved");
      notify.current();
      return true;
    } catch {
      setState("failed");
      return false;
    }
  }, [kit.id]);

  /** Saves what is on screen now, after any save already under way. */
  const flush = useCallback((): Promise<boolean> => {
    queue.current = queue.current.then(run);
    return queue.current;
  }, [run]);

  useEffect(() => {
    if (printOf(doc, name) === saved.current.print) {
      return;
    }
    setState("unsaved");
    const timer = window.setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [doc, name, flush]);

  // Leaving mid-pause still keeps the last change.
  useEffect(() => () => void flush(), [flush]);

  return { flush, state };
};
