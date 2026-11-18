import {
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { pageDesignOf } from "../../../../config/pageDesign.js";
import { CreativeEditor } from "../../../boards/creative/CreativeEditor";
import { markDesigned } from "../../../boards/geometry/frameLock";
import { pickImages } from "../../../boards/itemImages";
import { selectedIndex } from "../../../boards/itemOutput";
import {
  compositionOnBoard,
  type StudioComposition,
} from "../../../boards/studio/composition";
import {
  BoardImagesContext,
  boardImages,
} from "../../../boards/studio/imageShelf";
import { StudioPanel } from "../../../boards/studio/StudioPanel";
import { onOpenStudio } from "../../../boards/studio/studioEvents";
import type { BoardItem } from "../../../types";
import { frameImage } from "../reviewMerge/mergeFrames";
import { useAdFrames } from "./useAdFrames";

const PageCanvasEditor = lazy(() =>
  import("../../../boards/pages/PageCanvasEditor").then((m) => ({
    default: m.PageCanvasEditor,
  }))
);

/**
 * Everything a frame can be turned into on the editor's side: ad sizes
 * (useAdFrames) and the full-screen creative editor. One hook so the board
 * editor wires frames up in one place. It also hosts the Studio panel, which
 * places what it makes the same way a dropped file is placed.
 */
export const useFrameDesign = (
  items: BoardItem[],
  change: (next: BoardItem[]) => void,
  dropFiles: (files: File[], point: { x: number; y: number }) => unknown,
  /** A free spot near the middle of the screen (useDropPoint). */
  dropPoint?: (
    list: BoardItem[],
    width: number,
    height: number
  ) => { x: number; y: number },
  selectedItem?: BoardItem | null
) => {
  const { duplicateFrame, fitFrame, resetScale } = useAdFrames(items, change);
  const [designing, setDesigning] = useState<string | null>(null);
  const [pageMode, setPageMode] = useState(false);
  // The Studio, opened from the insert palette by event (studioEvents.ts).
  const [studio, setStudio] = useState<string | null>(null);
  const live = useRef(items);
  live.current = items;
  const addComposition = (
    composition: StudioComposition,
    openFrame = false
  ) => {
    const { current } = live;
    const point = dropPoint?.(
      current,
      composition.width,
      composition.height
    ) ?? { x: 0, y: 0 };
    const group = compositionOnBoard(composition, point, current);
    const next = [...current, ...group];
    live.current = next;
    change(next);
    if (openFrame) {
      setDesigning(group[0]?.id ?? null);
    }
  };
  useEffect(() => onOpenStudio((toolId) => setStudio(toolId)), []);
  const editingFrame = items.find((item) => item.id === designing);
  let designer: ReactNode = null;
  if (editingFrame && (pageMode || pageDesignOf(editingFrame.config))) {
    designer = (
      <PageCanvasEditor
        frame={editingFrame}
        key={editingFrame.id}
        onChange={(pageDesign) => {
          const next = live.current.map((item) =>
            item.id === editingFrame.id
              ? {
                  ...item,
                  config: { ...item.config, designed: true, pageDesign },
                  height: (item.width * pageDesign.height) / pageDesign.width,
                }
              : item
          );
          live.current = next;
          change(next);
        }}
        onClose={() => {
          setDesigning(null);
          setPageMode(false);
        }}
      />
    );
  } else if (designing) {
    designer = (
      <CreativeEditor
        frameId={designing}
        items={items}
        key={designing}
        onAddComposition={(composition) => addComposition(composition, true)}
        // Any change made here makes it a designed frame: one clipped object
        // on the canvas from then on (frameLock.ts).
        onChange={(next) => change(markDesigned(next, designing))}
        onClose={() => setDesigning(null)}
        onDesignPage={() => setPageMode(true)}
        onDropFiles={(files, point) => void dropFiles(files, point)}
      />
    );
  }
  // Every Studio image picker, here or in the frame editor, offers these.
  const pictures = useMemo(() => boardImages(items), [items]);
  const selectedImage = selectedItem
    ? (selectedItem.imageUrl ??
      pickImages(selectedItem.result)[selectedIndex(selectedItem.config ?? {})]
        ?.url ??
      (typeof selectedItem.config?.renderUrl === "string"
        ? selectedItem.config.renderUrl
        : null))
    : null;
  const studioPanel = studio ? (
    <StudioPanel
      initialTool={studio}
      onAdd={(file) => {
        // Where a dropped file goes: a free spot near the middle of the view.
        const point = dropPoint?.(items, 480, 480) ?? { x: 0, y: 0 };
        void dropFiles([file], { x: point.x + 240, y: point.y + 240 });
      }}
      onAddComposition={addComposition}
      onAddMany={(files) => {
        const point = dropPoint?.(items, 480, 480) ?? { x: 0, y: 0 };
        void dropFiles(files, { x: point.x + 240, y: point.y + 240 });
      }}
      onClose={() => setStudio(null)}
      selectedImage={selectedImage}
    />
  ) : null;
  return {
    designer: (
      <BoardImagesContext.Provider value={pictures}>
        <Suspense fallback={null}>{designer}</Suspense>
        {studioPanel}
      </BoardImagesContext.Provider>
    ),
    designFrame: (id: string) => {
      setPageMode(false);
      setDesigning(id);
    },
    duplicateFrame,
    fitFrame,
    /** A frame as one uploaded picture, from the board as it is now. */
    frameImage: (frameId: string) => {
      const frame = live.current.find((item) => item.id === frameId);
      return frame
        ? frameImage(frame, live.current)
        : Promise.reject(new Error("That frame is gone."));
    },
    resetScale,
  };
};
