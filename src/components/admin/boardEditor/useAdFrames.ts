import { toast } from "sonner";
import { AD_SIZES } from "../../../../config/adLayout";
import {
  copyFrameAtSizes,
  duplicateFrame as duplicated,
  resizeFrame,
} from "../../../boards/io/adFrames";
import type { FitMode } from "../../../boards/panels/AdSizesPanel";
import type { BoardItem } from "../../../types";

/**
 * The editor side of ad sizes: picks the sizes, applies the layout from
 * boards/io/adFrames.ts in one change (so one undo), and says what happened.
 */
export const useAdFrames = (
  items: BoardItem[],
  change: (next: BoardItem[]) => void
) => {
  const fitFrame = (frameId: string, sizeIds: string[], mode: FitMode) => {
    const sizes = AD_SIZES.filter((size) => sizeIds.includes(size.id));
    const [first] = sizes;
    if (!first) {
      return;
    }
    if (mode === "resize") {
      const next = resizeFrame(items, frameId, first);
      if (next) {
        change(next);
        toast.success(`Resized to ${first.w}×${first.h}`);
      }
      return;
    }
    const out = copyFrameAtSizes(items, frameId, sizes);
    if (out) {
      change([...items, ...out.added]);
      toast.success(
        sizes.length === 1 ? "Made a copy" : `Made ${sizes.length} copies`
      );
    }
  };
  const duplicateFrame = (frameId: string) => {
    const out = duplicated(items, frameId);
    if (out) {
      change([...items, ...out.added]);
      toast.success("Frame duplicated");
    }
  };
  return { duplicateFrame, fitFrame };
};
