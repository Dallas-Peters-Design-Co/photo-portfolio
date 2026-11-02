import { useEffect, useMemo, useState } from "react";
import { CreativeEditor } from "../../../boards/creative/CreativeEditor";
import { markDesigned } from "../../../boards/geometry/frameLock";
import {
  BoardImagesContext,
  boardImages,
} from "../../../boards/studio/imageShelf";
import { StudioPanel } from "../../../boards/studio/StudioPanel";
import { onOpenStudio } from "../../../boards/studio/studioEvents";
import type { BoardItem } from "../../../types";
import { useAdFrames } from "./useAdFrames";

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
  ) => { x: number; y: number }
) => {
  const { fitFrame } = useAdFrames(items, change);
  const [designing, setDesigning] = useState<string | null>(null);
  // The Studio, opened from the insert palette by event (studioEvents.ts).
  const [studio, setStudio] = useState<string | null>(null);
  useEffect(() => onOpenStudio((toolId) => setStudio(toolId)), []);
  const designer = designing ? (
    <CreativeEditor
      frameId={designing}
      items={items}
      // Any change made here makes it a designed frame: one clipped object
      // on the canvas from then on (frameLock.ts).
      onChange={(next) => change(markDesigned(next, designing))}
      onClose={() => setDesigning(null)}
      onDropFiles={(files, point) => void dropFiles(files, point)}
    />
  ) : null;
  const studioPanel = studio ? (
    <StudioPanel
      initialTool={studio}
      onAdd={(file) => {
        // Where a dropped file goes: a free spot near the middle of the view.
        const point = dropPoint?.(items, 480, 480) ?? { x: 0, y: 0 };
        void dropFiles([file], { x: point.x + 240, y: point.y + 240 });
      }}
      onClose={() => setStudio(null)}
    />
  ) : null;
  // Every Studio image picker, here or in the frame editor, offers these.
  const pictures = useMemo(() => boardImages(items), [items]);
  return {
    designer: (
      <BoardImagesContext.Provider value={pictures}>
        {designer}
        {studioPanel}
      </BoardImagesContext.Provider>
    ),
    designFrame: setDesigning,
    fitFrame,
  };
};
