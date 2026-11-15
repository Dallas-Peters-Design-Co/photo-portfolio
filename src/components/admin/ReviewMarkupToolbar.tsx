import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  Eraser,
  Highlighter,
  MapPin,
  MousePointer2,
  PenLine,
  Redo2,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";
import type { MarkKind } from "../../../config/review.js";
import { Button } from "../ui/button.js";

/** What a click or drag on the screenshot does. */
export type ReviewTool = "pin" | "select" | "erase" | MarkKind;

const TOOLS: { hint: string; icon: typeof MapPin; id: ReviewTool }[] = [
  { hint: "Note — click to pin a numbered note", icon: MapPin, id: "pin" },
  { hint: "Box — drag around something", icon: Square, id: "box" },
  {
    hint: "Highlight — drag to tint an area",
    icon: Highlighter,
    id: "highlight",
  },
  { hint: "Arrow — drag from tail to tip", icon: ArrowUpRight, id: "arrow" },
  { hint: "Pen — draw freehand", icon: PenLine, id: "pen" },
  {
    hint: "Edit — click a mark, drag it or its ends, Delete removes it",
    icon: MousePointer2,
    id: "select",
  },
  {
    hint: "Eraser — click a mark or note to remove it",
    icon: Eraser,
    id: "erase",
  },
];

/**
 * The markup tools above a review screenshot.
 *
 * Note pins stay the default: they carry the words, and markup only points
 * at things. Undo and redo cover pins and markup (also ⌘Z / ⇧⌘Z); the eraser
 * removes one thing at a time, and "Clear markup" all the drawing at once.
 */
export function ReviewMarkupToolbar({
  canClear,
  canOrderPins,
  canRedo,
  canUndo,
  onClear,
  onOrderPins,
  onRedo,
  onTool,
  onUndo,
  tool,
}: {
  canClear: boolean;
  canOrderPins: boolean;
  canRedo: boolean;
  canUndo: boolean;
  onClear: () => void;
  onOrderPins: () => void;
  onRedo: () => void;
  onTool: (tool: ReviewTool) => void;
  onUndo: () => void;
  tool: ReviewTool;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1">
      <div aria-label="Markup tools" className="flex gap-1" role="toolbar">
        {TOOLS.map(({ hint, icon: Icon, id }) => (
          <Button
            aria-label={hint}
            aria-pressed={tool === id}
            key={id}
            onClick={() => onTool(id)}
            size="icon"
            title={hint}
            type="button"
          >
            <Icon size={18} />
          </Button>
        ))}
      </div>
      <Button
        aria-label="Reorder pins top to bottom, left to right"
        disabled={!canOrderPins}
        onClick={onOrderPins}
        size="icon"
        title="Number pins from top to bottom, left to right across nearby points"
        type="button"
      >
        <ArrowDownWideNarrow size={18} />
      </Button>
      <div className="ml-2 flex gap-1">
        <Button
          aria-label="Undo (⌘Z)"
          disabled={!canUndo}
          onClick={onUndo}
          size="icon"
          title="Undo (⌘Z)"
          type="button"
        >
          <Undo2 size={18} />
        </Button>
        <Button
          aria-label="Redo (⇧⌘Z)"
          disabled={!canRedo}
          onClick={onRedo}
          size="icon"
          title="Redo (⇧⌘Z)"
          type="button"
        >
          <Redo2 size={18} />
        </Button>
      </div>
      {canClear ? (
        <Button onClick={onClear} size="icon" type="button">
          <Trash2 size={18} />
        </Button>
      ) : null}
    </div>
  );
}
