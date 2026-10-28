import {
  ArrowUpRight,
  Eraser,
  Highlighter,
  MapPin,
  PenLine,
  Redo2,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";
import type { MarkKind } from "../../../config/review.js";

/** What a click or drag on the screenshot does. */
export type ReviewTool = "pin" | "erase" | MarkKind;

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
    hint: "Eraser — click a mark or note to remove it",
    icon: Eraser,
    id: "erase",
  },
];

const iconButton =
  "flex size-8 items-center justify-center rounded-md border transition-colors";
const idle =
  "border-white/15 text-white/70 hover:border-white/40 hover:text-white disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:text-white/70";

/**
 * The markup tools above a review screenshot.
 *
 * Note pins stay the default: they carry the words, and markup only points
 * at things. Undo and redo cover pins and markup (also ⌘Z / ⇧⌘Z); the eraser
 * removes one thing at a time, and "Clear markup" all the drawing at once.
 */
export function ReviewMarkupToolbar({
  canClear,
  canRedo,
  canUndo,
  onClear,
  onRedo,
  onTool,
  onUndo,
  tool,
}: {
  canClear: boolean;
  canRedo: boolean;
  canUndo: boolean;
  onClear: () => void;
  onRedo: () => void;
  onTool: (tool: ReviewTool) => void;
  onUndo: () => void;
  tool: ReviewTool;
}) {
  const active = TOOLS.find((t) => t.id === tool);
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1">
      <div aria-label="Markup tools" className="flex gap-1" role="toolbar">
        {TOOLS.map(({ hint, icon: Icon, id }) => (
          <button
            aria-label={hint}
            aria-pressed={tool === id}
            className={`${iconButton} ${
              tool === id ? "border-white bg-white text-black" : idle
            }`}
            key={id}
            onClick={() => onTool(id)}
            title={hint}
            type="button"
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      <div className="ml-2 flex gap-1">
        <button
          aria-label="Undo (⌘Z)"
          className={`${iconButton} ${idle}`}
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo (⌘Z)"
          type="button"
        >
          <Undo2 size={15} />
        </button>
        <button
          aria-label="Redo (⇧⌘Z)"
          className={`${iconButton} ${idle}`}
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo (⇧⌘Z)"
          type="button"
        >
          <Redo2 size={15} />
        </button>
      </div>
      <span className="ml-2 text-sm text-white/60 uppercase tracking-[0.16em]">
        {active?.hint}
      </span>
      {canClear ? (
        <button
          className="ml-auto flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[12px] text-white/80 hover:border-red-400 hover:text-red-300"
          onClick={onClear}
          type="button"
        >
          <Trash2 size={13} /> Clear markup
        </button>
      ) : null}
    </div>
  );
}
