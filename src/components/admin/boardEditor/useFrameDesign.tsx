import { useState } from "react";
import { CreativeEditor } from "../../../boards/creative/CreativeEditor";
import type { BoardItem } from "../../../types";
import { useAdFrames } from "./useAdFrames";

/**
 * Everything a frame can be turned into on the editor's side: ad sizes
 * (useAdFrames) and the full-screen creative editor. One hook so the board
 * editor wires frames up in one place.
 */
export const useFrameDesign = (
  items: BoardItem[],
  change: (next: BoardItem[]) => void,
  dropFiles: (files: File[], point: { x: number; y: number }) => unknown
) => {
  const { fitFrame } = useAdFrames(items, change);
  const [designing, setDesigning] = useState<string | null>(null);
  const designer = designing ? (
    <CreativeEditor
      frameId={designing}
      items={items}
      onChange={change}
      onClose={() => setDesigning(null)}
      onDropFiles={(files, point) => void dropFiles(files, point)}
    />
  ) : null;
  return { designer, designFrame: setDesigning, fitFrame };
};
