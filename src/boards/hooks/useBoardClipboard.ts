import { useEffect, useRef } from "react";
import type { BoardItem, BoardWire } from "../../types";
import { selectedItems } from "../geometry/selectionModel";
import { isBoardDrop } from "../io/isVideo";
import {
  bundleOf,
  clipFrom,
  holdClip,
  pasteOnBoard,
} from "../io/itemClipboard";
import { isTyping } from "./isTyping";

/** A pasted address worth treating as an image. No whitespace: one URL, not prose. */
const HTTP_URL = /^https?:\/\/\S+$/i;

interface BoardClipboard {
  /** Off on a published board and while a node is being edited. */
  enabled: boolean;
  items: BoardItem[];
  onChange: (items: BoardItem[]) => void;
  onDropFiles?: (files: File[], point: { x: number; y: number }) => void;
  onDropImage?: (
    image: { url: string },
    point: { x: number; y: number }
  ) => void;
  onWiresChange?: (wires: BoardWire[]) => void;
  removeIds: (ids: Set<string>) => void;
  selection: ReadonlySet<string>;
  setSelection: (next: ReadonlySet<string>) => void;
  viewCentre: () => { x: number; y: number };
  wires: BoardWire[];
}

/**
 * Whether a clipboard event is the board's: not aimed at a field, not over
 * text someone has selected to copy, and not while the frame editor is open
 * (it has its own ⌘C, ⌘X and ⌘V for layers).
 */
const forTheBoard = (): boolean => {
  if (isTyping(document.activeElement)) {
    return false;
  }
  if (document.querySelector("[data-frame-editor]")) {
    return false;
  }
  const picked = window.getSelection();
  return !picked || picked.isCollapsed;
};

/**
 * Cut, copy and paste on the board. ⌘C and ⌘X take the selection (a frame
 * with everything on it, and the wires between what's taken); ⌘V puts a
 * fresh copy down, on this board or another, in this tab or another.
 *
 * Paste also takes a picture or an image address from anywhere else: the
 * same act as dropping a file, down the same path. These listen on the
 * window because clipboard events go to whatever has focus, which on a board
 * you're looking at is the document.
 */
export const useBoardClipboard = (props: BoardClipboard): void => {
  // Read at event time, so the listeners are added once.
  const live = useRef(props);
  live.current = props;
  const { enabled } = props;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const take = (e: ClipboardEvent, cut: boolean) => {
      const p = live.current;
      const chosen = selectedItems(p.selection, p.items);
      if (chosen.length === 0 || !forTheBoard()) {
        return;
      }
      e.preventDefault();
      const bundle = bundleOf(chosen, p.items, p.wires);
      holdClip(bundle, e);
      if (cut) {
        p.removeIds(new Set(bundle.items.map((i) => i.id)));
        p.setSelection(new Set());
      }
    };
    const onCopy = (e: ClipboardEvent) => take(e, false);
    const onCut = (e: ClipboardEvent) => take(e, true);
    const onPaste = (e: ClipboardEvent) => {
      if (!forTheBoard()) {
        return;
      }
      const p = live.current;
      const bundle = clipFrom(e);
      if (bundle) {
        e.preventDefault();
        const pasted = pasteOnBoard(bundle, p.items, p.viewCentre());
        p.onChange([...p.items, ...pasted.items]);
        if (pasted.wires.length > 0) {
          p.onWiresChange?.([...p.wires, ...pasted.wires]);
        }
        p.setSelection(new Set(pasted.items.map((i) => i.id)));
        return;
      }
      const files = [...(e.clipboardData?.files ?? [])].filter((file) =>
        isBoardDrop(file)
      );
      if (files.length > 0 && p.onDropFiles) {
        e.preventDefault();
        p.onDropFiles(files, p.viewCentre());
        return;
      }
      // No bitmap, but an address is the other way an image gets copied:
      // "copy image address" puts only text on the clipboard. Any http(s)
      // URL is taken, since plenty of image URLs have no extension; one that
      // isn't an image shows as a broken item and can be deleted.
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (text && p.onDropImage && HTTP_URL.test(text)) {
        e.preventDefault();
        p.onDropImage({ url: text }, p.viewCentre());
      }
    };
    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCut);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCut);
      window.removeEventListener("paste", onPaste);
    };
  }, [enabled]);
};
