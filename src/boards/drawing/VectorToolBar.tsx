import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import type { BoardItem } from "../../types";
import { PANEL_GAP } from "../geometry/panelPlacement";
import { useAnchoredPanel } from "../panels/useAnchoredPanel";
import { fitVectorBox, isVectorShape, ungroupVector } from "./vectorEdit";
import "./VectorToolBar.css";

/**
 * Over a selected vector shape on the board (text converted to outlines):
 * fit its box to the letters, or ungroup it into a layer per letter.
 * Nothing for any other item.
 */
export function VectorToolBar({
  anchor,
  chromeScale,
  item,
  onPatch,
  onReplace,
}: {
  anchor: RefObject<HTMLElement | null>;
  chromeScale: { transform: string };
  item: BoardItem;
  onPatch: (patch: Partial<BoardItem>) => void;
  /** The item swapped for these, in its place: how ungroup lands. */
  onReplace?: (items: BoardItem[]) => void;
}) {
  const { panelRef, placement } = useAnchoredPanel(anchor);
  if (!isVectorShape(item)) {
    return null;
  }
  const above = placement === "above";
  const parts = onReplace ? ungroupVector(item) : [];
  return (
    // Swallows its own presses, or the canvas starts a drag under them.
    <div
      className={`vector-toolbar ${above ? "vector-toolbar--above" : "vector-toolbar--below"}`}
      onPointerDown={(e) => e.stopPropagation()}
      ref={panelRef}
      style={{
        transform: `${chromeScale.transform} translateY(${above ? -PANEL_GAP : PANEL_GAP}px)`,
      }}
    >
      <Button
        onClick={() => onPatch(fitVectorBox(item))}
        size="sm"
        title="Fit the box to the shape"
        type="button"
        variant="ghost"
      >
        Fit box
      </Button>
      {onReplace && parts.length > 1 ? (
        <Button
          onClick={() => onReplace(parts)}
          size="sm"
          title={`Ungroup into ${parts.length} letters`}
          type="button"
          variant="ghost"
        >
          Ungroup
        </Button>
      ) : null}
    </div>
  );
}
