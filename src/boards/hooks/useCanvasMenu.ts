import { type MouseEvent as ReactMouseEvent, useCallback } from "react";
import type { BoardItem } from "../../types";
import { topmostAt } from "../geometry/hitTest";
import {
  type Selection,
  select,
  selectedItems,
} from "../geometry/selectionModel";
import type { CanvasMenuTarget } from "../panels/CanvasMenu";

/**
 * What a right-click on the board offers.
 *
 * Lifted out of BoardCanvas.tsx, which is the largest file in the project and
 * has been the reason three features this week ended in shuffling lines to fit
 * rather than in the change itself. The menu is a self-contained decision —
 * what is under the pointer, what is selected, which of the two the menu
 * should be built from — and none of it needs the rest of the canvas.
 */

interface CanvasMenuDeps {
  frameAt: (point: { x: number; y: number }) => BoardItem | null;
  items: BoardItem[];
  onCopyFrame?: unknown;
  onGroupIntoFrame?: unknown;
  readOnly: boolean;
  selection: Selection;
  setMenu: (target: CanvasMenuTarget | null) => void;
  setSelection: (next: Selection) => void;
  view: { toCanvas: (x: number, y: number) => { x: number; y: number } };
}

/**
 * Right-clicking a frame offers to copy it to a board of its own.
 *
 * Anywhere else keeps the browser's own menu, which is still how an image
 * gets saved or a link copied — so this only preempts it over a frame.
 */
export const useCanvasMenu = ({
  frameAt,
  items,
  onCopyFrame,
  onGroupIntoFrame,
  readOnly,
  selection,
  setMenu,
  setSelection,
  view,
}: CanvasMenuDeps) =>
  useCallback(
    (e: ReactMouseEvent) => {
      if (readOnly) {
        return;
      }
      // Both targets are gathered and the menu offers whichever apply. Asking
      // "is there a frame here?" first made grouping unreachable on any board
      // with a frame spread under the work — which is most of them.
      /*
       * Right-clicking something picks it up.
       *
       * The menu is built from the selection, so a right-click on an
       * unselected node offered nothing and handed the gesture to the browser
       * — which reads as the node having no menu. That is how a feature ships,
       * deploys, and stays invisible. Something already selected is left
       * alone, so right-clicking one of several still acts on all of them.
       */
      const at = view.toCanvas(e.clientX, e.clientY);
      const under = topmostAt(items, at, () => true);
      let chosen = selectedItems(selection, items);
      if (under && !selection.has(under.id)) {
        setSelection(select(under.id));
        chosen = [under];
      }
      const frame = onCopyFrame ? frameAt(at) : null;
      if (chosen.length === 0 && !frame) {
        // Nothing to offer, so the browser's own menu stays — which is still
        // how an image gets saved or a link copied.
        return;
      }
      e.preventDefault();
      setMenu({
        frame,
        point: { x: e.clientX, y: e.clientY },
        selection: onGroupIntoFrame ? chosen : [],
      });
    },
    [
      frameAt,
      items,
      onCopyFrame,
      onGroupIntoFrame,
      readOnly,
      selection,
      setMenu,
      setSelection,
      view,
    ]
  );
