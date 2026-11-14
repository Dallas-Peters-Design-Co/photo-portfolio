import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import { hexToOklch } from "../../../lib/oklch";
import { inkOn } from "./harmony";
import { hueSpacing } from "./scheme";

/**
 * The hue wheel: every colour sits on the ring at its hue, and is dragged
 * round it to set that hue by hand. The anchor's handle turns the whole
 * palette (the others are made from it); any other handle moves that colour
 * alone and holds it there until it's double-clicked back.
 *
 * Hue 0 is at the top and hues run clockwise, as the ring's own gradient
 * does, so a handle always sits on its colour.
 */

const RING = Array.from(
  { length: 13 },
  (_, i) => `oklch(0.74 0.14 ${i * 30})`
).join(", ");

export interface HueHandle {
  /** Can't be dragged: a neutral, a locked colour, a step of a ramp. */
  fixed?: boolean;
  /** Its hue was set by hand. */
  held?: boolean;
  hex: string;
  isAnchor?: boolean;
}

const hueOf = (hex: string) => hexToOklch(hex)?.h ?? 0;

export function HueMap({
  handles,
  onHue,
  onRelease,
}: {
  handles: HueHandle[];
  /** A handle dragged (or nudged) to a hue. */
  onHue: (index: number, hue: number) => void;
  /** A hand-set hue given back to the settings (double-click). */
  onRelease: (index: number) => void;
}) {
  const wheel = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  const hueAt = (e: { clientX: number; clientY: number }): number | null => {
    const box = wheel.current?.getBoundingClientRect();
    if (!box) {
      return null;
    }
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    // From the top, clockwise.
    return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  };

  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const hue = dragging.current === null ? null : hueAt(e);
    if (hue !== null && dragging.current !== null) {
      // Whole degrees; ⇧ snaps to fifteens.
      onHue(
        dragging.current,
        e.shiftKey ? Math.round(hue / 15) * 15 : Math.round(hue)
      );
    }
  };

  const nudge = (e: KeyboardEvent<HTMLButtonElement>, i: number, h: number) => {
    const by = { ArrowDown: -1, ArrowLeft: -1, ArrowRight: 1, ArrowUp: 1 }[
      e.key
    ];
    if (by) {
      e.preventDefault();
      e.stopPropagation();
      onHue(i, Math.round(h) + by * (e.shiftKey ? 10 : 1));
    }
  };

  const spacing = hueSpacing(
    handles.filter((h) => !h.fixed || h.isAnchor).map((h) => hueOf(h.hex))
  );

  return (
    <div className="studio-hue">
      <div
        className="studio-hue__wheel"
        ref={wheel}
        style={{ background: `conic-gradient(in oklch, ${RING})` }}
      >
        <div className="studio-hue__middle">
          <strong>{spacing === null ? "–" : `${spacing}°`}</strong>
          <span>least hue spacing</span>
        </div>
        {handles.map((handle, i) => {
          const h = hueOf(handle.hex);
          const name = handle.isAnchor ? "Anchor" : `Colour ${i + 1}`;
          return (
            <button
              aria-label={`${name} on the hue wheel`}
              aria-valuemax={360}
              aria-valuemin={0}
              aria-valuenow={Math.round(h)}
              className="studio-hue__handle"
              data-anchor={handle.isAnchor ? "" : undefined}
              data-held={handle.held ? "" : undefined}
              disabled={handle.fixed}
              // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its position
              key={i}
              onDoubleClick={() => onRelease(i)}
              onKeyDown={(e) => nudge(e, i, h)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragging.current = i;
              }}
              onPointerMove={move}
              onPointerUp={() => {
                dragging.current = null;
              }}
              role="slider"
              style={{
                background: handle.hex,
                color: inkOn(handle.hex),
                ["--hue" as string]: `${h}deg`,
              }}
              title={
                handle.fixed
                  ? name
                  : `${name}: drag round the wheel to set its hue${handle.held ? " · double-click to let the settings place it" : ""}`
              }
              type="button"
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
