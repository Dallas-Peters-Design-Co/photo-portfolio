import { useCallback, useEffect } from "react";
import type { DrawTool } from "../../../boards/drawing/drawing";
import {
  isTextEntry,
  onHistoryRequest,
} from "../../../boards/hooks/historyRequest";
import {
  restore,
  type useBoardHistory,
} from "../../../boards/hooks/useBoardHistory";
import { boardsApi } from "../../../services/portfolioService";
import type { BoardItem, BoardWire } from "../../../types";

/**
 * The two things the window tells the board.
 *
 * Lifted out of BoardEditor.tsx, which had no room left to grow. Both are
 * listeners registered once and read through a ref, deliberately: re-subscribing
 * pagehide on every drag frame would be its own performance problem, so neither
 * effect depends on the state it reads.
 *
 * The flush matters more than it looks. Saving is debounced, so the last second
 * or so of work has not reached the server — and because a board has its own
 * URL, coming back to it after a dropped tab looks exactly like the work was
 * saved. `keepalive` lets the request outlive the page; a normal fetch is
 * cancelled the moment the document goes away.
 */
export interface BoardWindowDeps {
  boardId: string;
  history: ReturnType<typeof useBoardHistory>;
  /** The latest state, kept in a ref so a listener never reads a stale copy. */
  pending: React.RefObject<{
    isDirty: boolean;
    isLoaded: boolean;
    items: BoardItem[];
    wires: BoardWire[];
  }>;
  setDrawTool: React.Dispatch<React.SetStateAction<DrawTool | null>>;
  setIsDirty: (dirty: boolean) => void;
  setIsInserting: React.Dispatch<React.SetStateAction<boolean>>;
  setItems: React.Dispatch<React.SetStateAction<BoardItem[]>>;
  setWires: React.Dispatch<React.SetStateAction<BoardWire[]>>;
}

export const useBoardWindowEvents = (deps: BoardWindowDeps) => {
  const {
    boardId,
    history,
    pending,
    setDrawTool,
    setIsDirty,
    setIsInserting,
    setItems,
    setWires,
  } = deps;

  /**
   * Flushes on the way out.
   *
   * The debounce means the last second or so of work has not reached the server
   * yet, so a reload, a closed tab, or a backgrounded phone would drop it — the
   * board having its own URL makes that worse, because coming back looks like
   * the work was saved. keepalive lets the request outlive the page; a normal
   * fetch is cancelled the moment the document goes away.
   */
  // The ref is read here, never subscribed to. Depending on `pending.current`
  // would re-register pagehide on every drag frame — precisely the cost this
  // ref exists to avoid, and the reason the effect takes only `boardId`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: explained above
  useEffect(() => {
    const flush = () => {
      const {
        isDirty: unsaved,
        isLoaded: ready,
        items: latest,
        wires: latestWires,
      } = pending.current;
      // Same guard as save(): a page closing before the board loaded must not
      // flush an empty arrangement over a full one.
      if (unsaved && ready) {
        boardsApi.flush(boardId, latest, latestWires);
      }
    };

    // pagehide covers reload, navigation and tab close. visibilitychange is the
    // one that fires when a phone backgrounds the app, which on iOS may be the
    // last callback before the page is discarded.
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [boardId]);

  /**
   * The pointer lift ends a gesture, for the history's benefit.
   *
   * The snapshot stack collapses edits that arrive close together, because a
   * drag emits one per pointer move and undoing a drag a pixel at a time is
   * useless. Time alone cannot tell where one gesture stops and the next
   * starts, though: two drags two hundred milliseconds apart look exactly like
   * one long one, so the second recorded nothing and a single ⌘Z undid both.
   *
   * Bound here rather than in the canvas because this is where the history
   * already is. Every gesture on a board ends with a pointer lift, whatever
   * made it — dragging, resizing, wiring, drawing — so one listener covers all
   * of them and no edit path has to remember to announce that it has finished.
   */
  useEffect(() => {
    const lift = () => history.seal();
    // pointercancel counts as an end: a gesture the browser takes away is over
    // just as surely as one the user finishes, and leaving the run open would
    // swallow the next edit.
    window.addEventListener("pointerup", lift);
    window.addEventListener("pointercancel", lift);
    return () => {
      window.removeEventListener("pointerup", lift);
      window.removeEventListener("pointercancel", lift);
    };
  }, [history]);

  /**
   * One step back (or forward), restoring results that have since arrived.
   *
   * Reads the board from `pending`, the ref that always holds what is on
   * screen, and sets the result plainly. It used to call the history from
   * inside nested state updaters; when React ran those straight away (its
   * fast path, the usual case for a click), the restore was queued *before*
   * the outer update, which then put the old board back: every undo was
   * undone in the same instant, and redo with it.
   */
  const step = useCallback(
    (redo: boolean) => {
      const { items, wires } = pending.current;
      const now = { items, wires };
      const next = redo ? history.redo(now) : history.undo(now);
      if (!next) {
        return;
      }
      const restored = restore(next, items);
      // Held now, so a second ⌘Z before React re-renders steps from here.
      pending.current = { ...pending.current, ...restored };
      setItems(restored.items);
      setWires(restored.wires);
      setIsDirty(true);
    },
    [history, pending, setIsDirty, setItems, setWires]
  );

  /**
   * ⌘/ opens the insert palette.
   *
   * The header has run out of room — notes, text, images, three node types, a
   * frame and 189 shaders do not fit on a toolbar — and searching is faster
   * than hunting a button even when they do.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setIsInserting((open) => !open);
        return;
      }
      // Undo and redo. Ignored while typing: a field has its own undo, and
      // stealing it would make editing a prompt lose the prompt rather than
      // the last character. A slider or colour well isn't typing.
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "z" &&
        !isTextEntry(document.activeElement)
      ) {
        e.preventDefault();
        step(e.shiftKey);
        return;
      }
      // Escape puts the pointer back. Without it a chosen tool is a mode you
      // can only leave by finding the toolbar again, and since a tool draws on
      // every press it also means nothing on the board can be moved — which
      // reads as the cursor being stuck rather than as a mode being on.
      if (e.key === "Escape") {
        setDrawTool((current) => {
          if (current === null) {
            return current;
          }
          e.preventDefault();
          return null;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDrawTool, setIsInserting, step]);

  // The Undo and Redo buttons drawn over the board (the creative editor's).
  useEffect(() => onHistoryRequest(step), [step]);
};
