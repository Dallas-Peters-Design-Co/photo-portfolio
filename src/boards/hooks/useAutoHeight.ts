import { type RefObject, useEffect, useRef } from "react";
import type { BoardItem } from "../../types";

/**
 * A node that is as tall as what it holds.
 *
 * A node used to be a fixed box with a scrolling body. Whatever did not fit —
 * a second setting, the error under the Run button, a clip that came back
 * taller than the box — was behind a scrollbar nobody saw, and a node that
 * looked finished was hiding its own failure. Now the box is drawn at
 * `height: auto` and grows with its contents, the way fal's workflow nodes do,
 * so everything a node says is on screen. Only the width is the user's.
 *
 * The measured height is still written back onto the item, and that is the
 * point of this hook rather than a detail of it: the wires, the port handles
 * and the marquee all read `item.height`, and a box that grew without saying
 * so would leave its ports drawn where its bottom edge used to be.
 *
 * Measured with a ResizeObserver, which reports layout size — the canvas zoom
 * is a transform and does not change it, so the number is already in canvas
 * units. Checked again whenever the stored height changes as well, because an
 * undo can put back an old height without the box itself changing size, and
 * the observer only speaks when the box does.
 */

/** Below a pixel is rounding, and writing it back would be a save for nothing. */
const TOLERANCE_PX = 1;

/** Operation nodes fit their contents; photos, notes and frames keep their box. */
export const fitsContent = (item: BoardItem, readOnly: boolean): boolean =>
  // A published board shows only the picture, sized to the box the editor
  // left behind, so the box it was given is the one it keeps.
  item.kind === "op" && !readOnly;

export const useAutoHeight = (
  item: BoardItem,
  readOnly: boolean,
  onPatch: (patch: Partial<BoardItem>) => void
): RefObject<HTMLDivElement | null> => {
  const ref = useRef<HTMLDivElement>(null);
  // Read through refs so the observer is made once per node, not once per
  // render: every keystroke in a prompt re-renders the node.
  const stored = useRef(item.height);
  stored.current = item.height;
  const patch = useRef(onPatch);
  patch.current = onPatch;
  const active = fitsContent(item, readOnly);

  useEffect(() => {
    const box = ref.current;
    if (!(active && box)) {
      return;
    }
    const sync = () => {
      const measured = Math.ceil(box.offsetHeight);
      if (measured > 0 && Math.abs(measured - stored.current) > TOLERANCE_PX) {
        stored.current = measured;
        patch.current({ height: measured });
      }
    };
    const observer = new ResizeObserver(sync);
    observer.observe(box);
    sync();
    return () => observer.disconnect();
  }, [active]);

  // An undo or a remote save can restore a height the contents no longer
  // match. The observer will not fire — the box has not changed — so look.
  useEffect(() => {
    const box = ref.current;
    if (!(active && box)) {
      return;
    }
    const measured = Math.ceil(box.offsetHeight);
    if (measured > 0 && Math.abs(measured - item.height) > TOLERANCE_PX) {
      patch.current({ height: measured });
    }
  }, [active, item.height]);

  return ref;
};
