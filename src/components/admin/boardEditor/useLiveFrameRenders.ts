import type React from "react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  framesIntoShaders,
  framesToRender,
  withFrameRenders,
} from "../../../boards/io/frameRender";
import { portfolioService } from "../../../services/portfolioService";
import type { BoardItem, BoardWire } from "../../../types";

/**
 * Designed frames rendered for the items that draw them live.
 *
 * A frame wired into a node is flattened to one picture right before a run
 * (useBoardRun). A shader or a halftone never runs — it draws in the browser
 * from whatever is wired in — so a frame feeding one was never flattened, and
 * the item fell back to the topmost picture inside the frame: a designed
 * poster arrived as one of its photos.
 *
 * So here the render is made when the wire is, and again whenever the design
 * changes. Debounced, because a layer being dragged changes the design on
 * every pointer move; keyed on the frame's fingerprint (frameRenderKey.ts),
 * so a frame whose render is still current is left alone.
 */

/** Items that draw their wired picture themselves, with no run to render it. */
const drawsLive = (item: BoardItem): boolean =>
  item.kind === "shader" ||
  item.nodeType === "standard" ||
  item.nodeType === "social";

/** Long enough to outlast a drag; short enough not to feel like waiting. */
const SETTLE_MS = 900;

export interface LiveFrameDeps {
  items: BoardItem[];
  pending: React.RefObject<{
    items: BoardItem[];
    wires: BoardWire[];
  }>;
  save: (override?: { items?: BoardItem[] }) => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<BoardItem[]>>;
  wires: BoardWire[];
}

/** Every frame a live item reads that needs drawing, each once. */
const staleFrames = (
  items: BoardItem[],
  wires: BoardWire[],
  live: Set<string>
) => {
  const all = [
    ...framesToRender(items, wires),
    ...framesIntoShaders(items, wires),
  ];
  return all.filter(
    (f, i) => live.has(f.id) && all.findIndex((g) => g.id === f.id) === i
  );
};

const upload = async (png: Blob): Promise<string> =>
  (
    await portfolioService.uploadImageFile(
      new File([png], "frame.png", { type: "image/png" }),
      undefined,
      "boards/frames"
    )
  ).url;

export const useLiveFrameRenders = ({
  items,
  pending,
  save,
  setItems,
  wires,
}: LiveFrameDeps): void => {
  const busy = useRef(false);

  useEffect(() => {
    const live = new Set(
      wires
        .filter((w) =>
          items.some((i) => i.id === w.targetItemId && drawsLive(i))
        )
        .map((w) => w.sourceItemId)
    );
    if (live.size === 0) {
      return;
    }
    const stale = staleFrames(items, wires, live);
    if (stale.length === 0 || busy.current) {
      return;
    }
    const timer = setTimeout(async () => {
      busy.current = true;
      try {
        // Rendered from the board as it is now, not as it was when the
        // timer was set: the design may have moved on during the wait.
        const now = pending.current.items;
        const again = staleFrames(now, pending.current.wires, live);
        if (again.length === 0) {
          return;
        }
        const rendered = await withFrameRenders(again, now, upload, (m) =>
          toast.error(m)
        );
        const changed = new Map<string, BoardItem["config"]>();
        rendered.forEach((item, i) => {
          if (item !== now[i]) {
            changed.set(item.id, item.config);
          }
        });
        if (changed.size === 0) {
          return;
        }
        // Merged onto the freshest items, for the reason useBoardRun gives:
        // seconds have passed, and only the renders should land.
        const merged = pending.current.items.map((item) => {
          const config = changed.get(item.id);
          return config === undefined ? item : { ...item, config };
        });
        setItems(merged);
        await save({ items: merged });
      } finally {
        busy.current = false;
      }
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [items, wires, pending, save, setItems]);
};
