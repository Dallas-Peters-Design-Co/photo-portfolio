import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  ReviewImage,
  ReviewMark,
  ReviewPin,
  ReviewScreen,
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

/**
 * Pins and markup moved onto a new picture of the same page, so each stays
 * on what it marked.
 *
 * Positions are fractions of the image, and a recapture rarely has the old
 * height: the page grew, a header moved, the 6000px cap applied. Kept as
 * fractions, every note would slide. So each point is held at the same
 * distance down the page, measured in page widths — both pictures span the
 * full width — which also carries a 2x upload over to a 1x capture.
 *
 * `lost` counts the pins and marks that now fall below the new picture's end;
 * they are kept, pressed against the bottom edge, so nothing is deleted.
 */
export const moveMarkup = (
  markup: ScreenMarkup,
  from: ReviewImage,
  to: ReviewImage
): ScreenMarkup & { lost: number } => {
  const scale =
    from.height / Math.max(1, from.width) / (to.height / Math.max(1, to.width));
  let lost = 0;
  const moveY = (y: number): number => y * scale;
  const pins = markup.pins.map((pin) => {
    const y = moveY(pin.y);
    if (y > 1) {
      lost += 1;
    }
    return { ...pin, y: Math.min(1, y) };
  });
  const marks = markup.marks.map((mark) => {
    const points = mark.points.map(([x, y]): [number, number] => [
      x,
      Math.min(1, moveY(y)),
    ]);
    if (mark.points.every(([, y]) => moveY(y) > 1)) {
      lost += 1;
    }
    return { ...mark, points };
  });
  return { lost, marks, pins };
};

/** The screen with a new picture and its notes moved onto it. */
const withImage = (
  prev: ReviewScreen,
  image: ReviewImage,
  extra: Partial<ReviewScreen>
): ReviewScreen => {
  if (!prev.image) {
    return { ...prev, ...extra, image };
  }
  const { marks, pins } = moveMarkup(prev, prev.image, image);
  return { ...prev, ...extra, image, marks, pins };
};

/**
 * Replaces a screen's picture — a recapture or a fresh upload — keeping every
 * pin and mark on what it marked, and says so with an Undo.
 *
 * `current` is the screen as it stands now. The update itself is applied to
 * whatever the screen is when it lands, so a note typed while the capture ran
 * is kept; `current` is only for the count and for what Undo puts back.
 */
export const replaceScreenImage = (
  current: ReviewScreen,
  image: ReviewImage,
  onChange: (update: (prev: ReviewScreen) => ReviewScreen) => void,
  extra: Partial<ReviewScreen> = {}
): void => {
  onChange((prev) => withImage(prev, image, extra));
  const before = current;
  const kept = before.pins.length + before.marks.length;
  if (!before.image || kept === 0) {
    toast.success("Captured");
    return;
  }
  const { lost } = moveMarkup(before, before.image, image);
  const message =
    lost > 0
      ? `New picture. ${lost} of ${kept} notes fell past the end of the page and sit on the bottom edge.`
      : `New picture. All ${kept} notes kept in place.`;
  toast.success(message, {
    action: {
      label: "Undo",
      // The old picture and where everything was on it. Words typed since
      // are kept: they are not part of the picture.
      onClick: () =>
        onChange((prev) => ({
          ...prev,
          image: before.image,
          marks: before.marks,
          pins: prev.pins.map((pin) => {
            const old = before.pins.find((o) => o.id === pin.id);
            return old ? { ...pin, x: old.x, y: old.y } : pin;
          }),
          sourceUrl: before.sourceUrl,
        })),
    },
  });
};

/** `pins` in the order `ids` gives; any pin `ids` leaves out keeps its place at the end. */
export const orderPins = (pins: ReviewPin[], ids: string[]): ReviewPin[] => {
  const byId = new Map(pins.map((pin) => [pin.id, pin]));
  const ordered = ids.flatMap((id) => byId.get(id) ?? []);
  return [...ordered, ...pins.filter((pin) => !ids.includes(pin.id))];
};

/** Notes this close together vertically read as one line, left to right. */
const SAME_LINE_PX = 48;

/**
 * Pin ids in reading order: down the page, and left to right along a line.
 *
 * Two pins on one heading are rarely at exactly the same height, so a line
 * is everything within SAME_LINE_PX of where it starts, measured on the page
 * rather than as a fraction, so the tolerance is the same on a short screen
 * and a 6000px one.
 */
export const readingOrder = (
  pins: ReviewPin[],
  image: ReviewImage | null
): string[] => {
  const pagePx = image ? (image.height / Math.max(1, image.width)) * 1440 : 1;
  const sorted = [...pins].sort((a, b) => a.y - b.y);
  const lines: ReviewPin[][] = [];
  for (const pin of sorted) {
    const line = lines.at(-1);
    const start = line?.[0];
    if (line && start && (pin.y - start.y) * pagePx <= SAME_LINE_PX) {
      line.push(pin);
    } else {
      lines.push([pin]);
    }
  }
  return lines.flatMap((line) =>
    [...line].sort((a, b) => a.x - b.x).map((pin) => pin.id)
  );
};

/** The capture button's words: what it will do, or that it is doing it. */
export const captureLabelFor = (
  isCapturing: boolean,
  hasImage: boolean
): string => {
  if (isCapturing) {
    return "Capturing… (20–40s)";
  }
  return hasImage ? "Recapture" : "Capture";
};

export const RECAPTURE_HINT =
  "Take a new screenshot; pins and markup stay where they are on the page";

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
