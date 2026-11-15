import { BLANK_ITEM } from "../../components/admin/boardEditor/placement";
import type { BoardItem } from "../../types";
import { newItemId } from "../io/newItemId";

/** Editable layers made in Studio, positioned relative to their own origin. */
export interface StudioComposition {
  height: number;
  items: BoardItem[];
  title: string;
  width: number;
}

const topZ = (items: BoardItem[]): number =>
  Math.max(0, ...items.map((item) => item.z)) + 1;

/** One designed frame on the board, with the generated layers inside it. */
export const compositionOnBoard = (
  composition: StudioComposition,
  point: { x: number; y: number },
  existing: BoardItem[]
): BoardItem[] => {
  const z = topZ(existing);
  const frame: BoardItem = {
    ...BLANK_ITEM,
    ...point,
    body: composition.title,
    config: { designed: true },
    height: composition.height,
    id: newItemId(),
    kind: "frame",
    width: composition.width,
    z,
  };
  return [
    frame,
    ...composition.items.map((item, index) => ({
      ...item,
      id: newItemId(),
      x: point.x + item.x,
      y: point.y + item.y,
      z: z + index + 1,
    })),
  ];
};
