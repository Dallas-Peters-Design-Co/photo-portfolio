import { Maximize2, Minus, Plus } from "lucide-react";
import type { useArtboardZoom } from "./useArtboardZoom";

/**
 * The artboard's zoom, in the stage's corner: out, how big it's shown
 * (against the frame's real size), in, and back to fit. Pinch, ⌘/Ctrl +
 * wheel and ⌘+ / ⌘− / ⌘0 do the same.
 */
export function ZoomBar({
  view,
}: {
  view: ReturnType<typeof useArtboardZoom>;
}) {
  return (
    <div className="creative-zoom">
      <button
        aria-label="Zoom out (⌘−)"
        className="creative__icon"
        onClick={view.zoomOut}
        title="Zoom out (⌘−)"
        type="button"
      >
        <Minus size={14} />
      </button>
      <span className="creative-zoom__level">
        {Math.round(view.scale * 100)}%
      </span>
      <button
        aria-label="Zoom in (⌘+)"
        className="creative__icon"
        onClick={view.zoomIn}
        title="Zoom in (⌘+)"
        type="button"
      >
        <Plus size={14} />
      </button>
      <button
        aria-label="Fit to screen (⌘0)"
        aria-pressed={!view.zoomed}
        className="creative__icon"
        onClick={view.fit}
        title="Fit to screen (⌘0)"
        type="button"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}
