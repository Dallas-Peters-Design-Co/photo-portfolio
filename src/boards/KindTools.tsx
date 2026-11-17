import type { RefObject } from "react";
import type { BoardItem } from "../types";
import { BoardTextTools } from "./BoardTextTools";
import { VectorToolBar } from "./drawing/VectorToolBar";
import { SocialToolBar } from "./nodes/SocialNode";

/**
 * The bar a kind of item brings when it's the one selected: text its type
 * panel, a social mock-up its platform picker, a vector shape its fit and
 * ungroup. Each renders nothing for any other kind.
 */
export function KindTools({
  anchor,
  chromeScale,
  item,
  on,
  onPatch,
  onReplace,
  writable,
}: {
  anchor: RefObject<HTMLDivElement | null>;
  chromeScale: { transform: string };
  item: BoardItem;
  on: boolean;
  onPatch: (patch: Partial<BoardItem>) => void;
  /** The item swapped for several (a vector shape ungrouped). */
  onReplace?: (items: BoardItem[]) => void;
  writable: boolean;
}) {
  if (!on) {
    return null;
  }
  return writable ? (
    <BoardTextTools
      anchor={anchor}
      chromeScale={chromeScale}
      item={item}
      onPatch={onPatch}
    />
  ) : (
    <>
      <SocialToolBar
        anchor={anchor}
        chromeScale={chromeScale}
        item={item}
        onPatch={onPatch}
      />
      <VectorToolBar
        anchor={anchor}
        chromeScale={chromeScale}
        item={item}
        onPatch={onPatch}
        onReplace={onReplace}
      />
    </>
  );
}
