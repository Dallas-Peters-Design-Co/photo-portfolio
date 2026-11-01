import type { usePanelWidths } from "./usePanelWidths";

/**
 * The inner edge of a side panel: drag to resize, double-click to reset,
 * or focus it and use ← →.
 */
export function PanelEdge({
  panels,
  side,
}: {
  panels: ReturnType<typeof usePanelWidths>;
  side: "left" | "right";
}) {
  const open =
    side === "left" ? panels.panels.leftOpen : panels.panels.rightOpen;
  if (!open) {
    return null;
  }
  const name = side === "left" ? "layers panel" : "brand panel";
  return (
    <hr
      aria-label={`Resize the ${name}`}
      aria-orientation="vertical"
      aria-valuemax={520}
      aria-valuemin={180}
      aria-valuenow={panels.panels[side]}
      className={`creative__splitter creative__splitter--${side}`}
      onDoubleClick={() => panels.reset(side)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          panels.nudge(side, e.key === "ArrowRight" ? 16 : -16);
        }
      }}
      onPointerDown={panels.startDrag(side)}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
    />
  );
}
