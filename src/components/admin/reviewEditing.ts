import { useCallback, useRef, useState } from "react";
import type {
  ReviewMark,
  ReviewPin,
  RichText,
} from "../../../config/review.js";

/** Helpers shared by the review editor and its screens. */

const PARAGRAPH_BREAK = /\n\s*\n/;

/** Plain text from older reviews, as a document the rich editor can open. */
export const toEditorDoc = (value: RichText): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  return {
    content: value
      .split(PARAGRAPH_BREAK)
      .map((t) => t.trim())
      .map((text) =>
        text
          ? { content: [{ text, type: "text" }], type: "paragraph" }
          : { type: "paragraph" }
      ),
    type: "doc",
  };
};

/** The pixel size of an image file, read in the browser before upload. */
export const imageSize = (
  file: File
): Promise<{ height: number; width: number }> =>
  new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(src);
      resolve({ height: img.naturalHeight, width: img.naturalWidth });
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("That file is not an image"));
    };
    img.src = src;
  });

/** What undo restores on a screen: its pins and its markup. */
export interface ScreenMarkup {
  marks: ReviewMark[];
  pins: ReviewPin[];
}

const HISTORY_LIMIT = 50;

/**
 * Undo and redo for one screen's pins and markup.
 *
 * `record()` is called just before a change, with the screen as it stands, so
 * a whole drag or stroke is one step rather than one per mouse move. Typing in
 * a note is left out: text fields have their own undo.
 */
export function useMarkupHistory(
  current: ScreenMarkup,
  apply: (markup: ScreenMarkup) => void
) {
  const past = useRef<ScreenMarkup[]>([]);
  const future = useRef<ScreenMarkup[]>([]);
  // The stacks live in refs; this only re-renders the buttons.
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const record = useCallback(() => {
    past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), current];
    future.current = [];
    setVersion((v) => v + 1);
  }, [current]);

  const undo = () => {
    const previous = past.current.at(-1);
    if (!previous) {
      return;
    }
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, current];
    apply(previous);
    bump();
  };

  const redo = () => {
    const next = future.current.at(-1);
    if (!next) {
      return;
    }
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, current];
    apply(next);
    bump();
  };

  return {
    canRedo: future.current.length > 0,
    canUndo: past.current.length > 0,
    record,
    redo,
    undo,
  };
}

/** The screen the keyboard's undo applies to: the last one touched. */
let activeScreen: string | null = null;

export const touchScreen = (id: string) => {
  activeScreen = id;
};

export const isActiveScreen = (id: string): boolean => activeScreen === id;

/** True while the focus is somewhere text is typed. */
export const isTyping = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  return Boolean(
    el?.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName ?? "")
  );
};
