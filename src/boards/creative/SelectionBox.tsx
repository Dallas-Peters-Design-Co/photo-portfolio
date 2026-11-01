import type { PointerEvent as ReactPointerEvent } from "react";
import type { Box } from "./creativeModel";
import { rotateCss } from "./rotate";

/**
 * The selected layer's controls, drawn above every layer.
 *
 * They used to sit inside the layer itself, so anything stacked above it
 * covered its handles and took the press. Here they're a separate layer on
 * top: eight handles, every side a resize grip, and the inside a move grip
 * for the selected layer even where something else is drawn over it. A press
 * inside that doesn't move is passed to whatever is on top (see Artboard).
 * A round grip above the top edge turns the layer.
 */

export const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type Handle = (typeof HANDLES)[number];

const SIDES = ["n", "e", "s", "w"] as const;

export function SelectionBox({
  box,
  frame,
  onBegin,
  onDoubleClick,
  rotation = 0,
  scale,
}: {
  box: Box;
  frame: Box;
  /** A press on the inside (null), on a handle or side, or on the rotate grip. */
  onBegin: (e: ReactPointerEvent, handle: Handle | "rotate" | null) => void;
  onDoubleClick: () => void;
  /** Degrees; the selection turns with its layer. */
  rotation?: number;
  scale: number;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a pointer grip on a canvas; the layers list and arrow keys are the keyboard route
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same
    <div
      className="creative__selection"
      data-selection
      onDoubleClick={onDoubleClick}
      onPointerDown={(e) => onBegin(e, null)}
      style={{
        height: box.height,
        left: box.x - frame.x,
        top: box.y - frame.y,
        transform: rotateCss(rotation),
        width: box.width,
        ["--s" as string]: scale,
      }}
    >
      <span
        aria-hidden
        className="creative__rotate"
        onPointerDown={(e) => onBegin(e, "rotate")}
        title="Drag to rotate · Shift for 15° steps"
      />
      {SIDES.map((side) => (
        <span
          aria-hidden
          className={`creative__edge creative__edge--${side}`}
          key={side}
          onPointerDown={(e) => onBegin(e, side)}
        />
      ))}
      {HANDLES.map((handle) => (
        <span
          aria-hidden
          className={`creative__handle creative__handle--${handle}`}
          key={handle}
          onPointerDown={(e) => onBegin(e, handle)}
        />
      ))}
    </div>
  );
}
