import type { RefObject } from "react";
import type { BoardItem } from "../types";
import { BoardTextTools } from "./BoardTextTools";
import { SocialToolBar } from "./nodes/SocialNode";

/**
 * The bar a kind of item brings when it's the one selected: text its type
 * panel, a social mock-up its platform picker. Each renders nothing for any
 * other kind.
 */
export function KindTools({
  anchor,
  chromeScale,
  item,
  on,
  onPatch,
  writable,
}: {
  anchor: RefObject<HTMLDivElement | null>;
  chromeScale: { transform: string };
  item: BoardItem;
  on: boolean;
  onPatch: (patch: Partial<BoardItem>) => void;
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
    <SocialToolBar
      anchor={anchor}
      chromeScale={chromeScale}
      item={item}
      onPatch={onPatch}
    />
  );
}
