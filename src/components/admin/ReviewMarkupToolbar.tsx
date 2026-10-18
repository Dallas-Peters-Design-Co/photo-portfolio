import {
  ArrowUpRight,
  Highlighter,
  MapPin,
  PenLine,
  Square,
  Trash2,
} from "lucide-react";
import type { MarkKind } from "../../../config/review.js";

/** What a click or drag on the screenshot does. */
export type ReviewTool = "pin" | MarkKind;

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
];

/**
 * The markup tools above a review screenshot.
 *
 * Note pins stay the default: they carry the words, and markup only points
 * at things. A selected mark can be deleted here or with Delete/Backspace.
 */
export function ReviewMarkupToolbar({
  canDelete,
  onDelete,
  onTool,
  tool,
}: {
  canDelete: boolean;
  onDelete: () => void;
  onTool: (tool: ReviewTool) => void;
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
            className={`flex size-8 items-center justify-center rounded-md border transition-colors ${
              tool === id
                ? "border-white bg-white text-black"
                : "border-white/15 text-white/70 hover:border-white/40 hover:text-white"
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
      <span className="ml-2 text-[11px] text-white/60 uppercase tracking-[0.16em]">
        {active?.hint}
      </span>
      {canDelete ? (
        <button
          className="ml-auto flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[12px] text-white/80 hover:border-red-400 hover:text-red-300"
          onClick={onDelete}
          type="button"
        >
          <Trash2 size={13} /> Delete mark
        </button>
      ) : null}
    </div>
  );
}
