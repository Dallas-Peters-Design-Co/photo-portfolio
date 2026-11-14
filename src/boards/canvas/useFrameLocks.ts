import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import type { BoardItem } from "../../types";
import { useFrameActions } from "../FrameOpenContext";
import {
  clipPathFor,
  frameLocks,
  isDesignFrame,
  liftToFrames,
} from "../geometry/frameLock";
import type { Selection } from "../geometry/selectionModel";

/**
 * Design frames as single objects on the canvas (geometry/frameLock.ts): what
 * a press on their contents picks up, the selection kept to the frames, and
 * the clip and double-click each item inside one is drawn with.
 */
export const useFrameLocks = (
  items: BoardItem[],
  selection: Selection,
  setSelection: Dispatch<SetStateAction<Selection>>
) => {
  const locks = useMemo(() => frameLocks(items), [items]);
  const { designFrame } = useFrameActions();

  // However something inside got selected (a sweep, select-all, the layers
  // list, or being dropped onto a frame while selected), its frame is what's
  // selected instead.
  useEffect(() => {
    if ([...selection].some((id) => locks.has(id))) {
      setSelection((current) => liftToFrames(current, locks));
    }
  }, [locks, selection, setSelection]);

  /** The index a press on this item should act on: its frame's, if it has one. */
  const pressIndex = useCallback(
    (index: number): number => {
      const lock = locks.get(items[index]?.id ?? "");
      const owner = lock ? items.findIndex((i) => i.id === lock.owner) : -1;
      return owner >= 0 ? owner : index;
    },
    [items, locks]
  );

  const inFrame = (item: BoardItem) => {
    const lock = locks.get(item.id);
    if (!lock) {
      // The design frame itself opens too: a double-click on its own area,
      // or on a picture behind it that the frame's box sits over.
      return designFrame && isDesignFrame(item, items)
        ? { clipPath: null, isFrame: true, open: () => designFrame(item.id) }
        : undefined;
    }
    return {
      clipPath: clipPathFor(item, lock.clip),
      open: designFrame ? () => designFrame(lock.owner) : undefined,
    };
  };

  return { inFrame, pressIndex };
};
