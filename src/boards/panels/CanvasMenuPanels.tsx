import { HugeiconsIcon } from "@hugeicons/react";
import Album02Icon from "@hugeicons-pro/core-stroke-standard/Album02Icon";
import ArrowRight02Icon from "@hugeicons-pro/core-stroke-standard/ArrowRight02Icon";
import MagicWand01Icon from "@hugeicons-pro/core-stroke-standard/MagicWand01Icon";
import type { BoardItem } from "../../types";
import { toolContextOf } from "../tools/itemContext";
import { toolsForKind } from "../tools/registry";
import type { Tool } from "../tools/types";
import { ToolPicker } from "./ToolPicker";
import "../boardChrome.css";

/**
 * Panels the canvas menu turns itself into.
 *
 * Both replace the row list rather than opening beside it, because the menu is
 * 240px of chrome floating over a board and a second popup hanging off it would
 * be two things to dismiss. Extracted from CanvasMenu because each is a panel
 * with its own state, and the menu was heading past its size ceiling one panel
 * at a time.
 */

/**
 * Whether opening the picker on this item would show anything.
 *
 * Every kind has at least one tool by design (see `Tool.appliesTo`), so this is
 * really asking whether the item is a kind the registry knows at all — a wire
 * or a comment is not.
 */
export const hasTools = (item: BoardItem): boolean =>
  toolsForKind(item.kind).length > 0;

/**
 * Opens the collection panel for the selection's pictures.
 *
 * Beside "save as an element", because both keep something — but an element is a
 * style distilled from pictures, where a collection is the pictures themselves,
 * kept as material for a page. Two rows rather than one with a choice, since the
 * two answers are not versions of each other.
 */
/** Where a selection's pictures can be sent from the menu. */
export type CollectTarget = "collection" | "board";

/**
 * Keeping the selection's pictures somewhere else: a collection, or another
 * board. Two rows, one component, because they are the same gesture and are
 * offered under the same condition.
 */
export function CollectionRow({
  className,
  count,
  onOpen,
}: {
  className: string;
  count: number;
  onOpen: (into: CollectTarget) => void;
}) {
  const what = count === 1 ? "it" : String(count);
  return (
    <button
      className={className}
      onClick={() => onOpen("collection")}
      type="button"
    >
      <HugeiconsIcon aria-hidden icon={Album02Icon} size={14} />
      <span>Save {what} to a collection</span>
    </button>
  );
}

/**
 * Sends the selection itself to another board: frames with everything on
 * them, and anything else as it is, laid out as it was (CopyFramesPanel).
 */
export function SendToBoardRow({
  className,
  items,
  onSend,
}: {
  className: string;
  items: BoardItem[];
  onSend: () => void;
}) {
  const frames = items.filter((item) => item.kind === "frame").length;
  let what = items.length === 1 ? "it" : String(items.length);
  if (frames === items.length && frames > 1) {
    what = `${frames} frames`;
  } else if (frames === 1 && items.length === 1) {
    what = "the frame";
  }
  return (
    <button className={className} onClick={onSend} type="button">
      <HugeiconsIcon aria-hidden icon={ArrowRight02Icon} size={14} />
      <span>Send {what} to a board</span>
    </button>
  );
}

/** Opens the tool list for the one selected item. */
export function ToolsRow({
  className,
  onOpen,
}: {
  className: string;
  onOpen: () => void;
}) {
  return (
    <button className={className} onClick={onOpen} type="button">
      <HugeiconsIcon aria-hidden icon={MagicWand01Icon} size={14} />
      <span>Tools…</span>
    </button>
  );
}

/**
 * The picker, wearing the menu's own chrome rather than its own.
 *
 * The context comes from `toolContextOf`, which is also what the runner checks
 * before spending — so a row that is enabled here is a row that will run, and a
 * disabled one carries the sentence the runner would have refused with.
 */
export function ToolsPanel({
  item,
  onClose,
  onPick,
}: {
  item: BoardItem;
  onClose: () => void;
  onPick: (item: BoardItem, tool: Tool) => void;
}) {
  return (
    <ToolPicker
      className="tool-picker--embedded"
      context={toolContextOf(item)}
      kind={item.kind}
      onClose={onClose}
      onPick={(tool) => onPick(item, tool)}
    />
  );
}
