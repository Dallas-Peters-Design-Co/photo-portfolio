import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useComponentVersion } from "../../../boards/components/store";
import {
  framesIntoShaders,
  framesToRender,
  renderFrameBlob,
} from "../../../boards/io/frameRender";
import { frameKeyOf } from "../../../boards/io/frameRenderKey";
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
const SETTLE_MS = 120;

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
const staleFrames = (items: BoardItem[], wires: BoardWire[]) => {
  const targets = new Set(items.filter(drawsLive).map((item) => item.id));
  const liveWires = wires.filter((w) => targets.has(w.targetItemId));
  if (!liveWires.length) {
    return [];
  }
  const all = [
    ...framesToRender(items, liveWires),
    ...framesIntoShaders(items, liveWires),
  ];
  return all.filter((f, i) => all.findIndex((g) => g.id === f.id) === i);
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
}: LiveFrameDeps): ReadonlyMap<string, string> => {
  const [local, setLocal] = useState(new Map<string, string>());
  const latest = useRef({ pending, save, setItems });
  latest.current = { pending, save, setItems };
  // Unrelated board activity must not restart the debounce. Include the
  // design fingerprint so an edit during an upload schedules its own render.
  const componentVersion = useComponentVersion();
  // The frame fingerprint reads component definitions from the external store.
  // biome-ignore lint/correctness/useExhaustiveDependencies: componentVersion invalidates that lookup
  const work = useMemo(
    () =>
      JSON.stringify(
        staleFrames(items, wires).map((frame) => [
          frame.id,
          frameKeyOf(frame, items),
        ])
      ),
    [items, wires, componentVersion]
  );

  useEffect(() => {
    if (work === "[]") {
      return;
    }
    let cancelled = false;
    const urls = new Set<string>();
    const render = async () => {
      const graph = latest.current.pending.current;
      const frames = staleFrames(graph.items, graph.wires);
      const updates = new Map<
        string,
        { renderKey: string; renderUrl: string }
      >();
      const uploads: Promise<void>[] = [];
      const reportError = (err: unknown) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Couldn't render the frame"
          );
        }
      };
      for (const frame of frames) {
        try {
          const renderKey = frameKeyOf(frame, graph.items);
          // biome-ignore lint/performance/noAwaitInLoops: rasterize one full-size canvas at a time
          const png = await renderFrameBlob(frame, graph.items);
          if (cancelled) {
            return;
          }
          const url = URL.createObjectURL(png);
          urls.add(url);
          setLocal((previous) => new Map(previous).set(frame.id, url));
          uploads.push(
            upload(png)
              .then((renderUrl) => {
                updates.set(frame.id, { renderKey, renderUrl });
              })
              .catch(reportError)
          );
        } catch (err) {
          reportError(err);
        }
      }
      await Promise.all(uploads);
      if (cancelled || !updates.size) {
        return;
      }
      const { current } = latest.current.pending;
      let changed = false;
      const merged = current.items.map((item) => {
        const update = updates.get(item.id);
        if (!update || update.renderKey !== frameKeyOf(item, current.items)) {
          return item;
        }
        changed = true;
        return {
          ...item,
          config: {
            ...item.config,
            renderKey: update.renderKey,
            renderUrl: update.renderUrl,
          },
        };
      });
      if (changed) {
        latest.current.setItems(merged);
        await latest.current.save({ items: merged });
      }
    };
    const timer = setTimeout(() => {
      render().catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error
              ? err.message
              : "Couldn't update the frame render"
          );
        }
      });
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (urls.size) {
        setLocal(
          (previous) =>
            new Map([...previous].filter(([, url]) => !urls.has(url)))
        );
        for (const url of urls) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, [work]);

  return useMemo(() => {
    const previews = new Map<string, string>();
    const shaders = new Set(
      items.filter((item) => item.kind === "shader").map((item) => item.id)
    );
    for (const wire of wires) {
      const url = local.get(wire.sourceItemId);
      if (
        url &&
        wire.targetPort === "image" &&
        shaders.has(wire.targetItemId)
      ) {
        previews.set(wire.targetItemId, url);
      }
    }
    return previews;
  }, [items, local, wires]);
};
