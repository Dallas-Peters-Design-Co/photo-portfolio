import { HugeiconsIcon } from "@hugeicons/react";
import CropIcon from "@hugeicons-pro/core-stroke-standard/CropIcon";
import {
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import {
  type SafeZone,
  sizeFromTitle,
  sizeOfTitle,
} from "../../../config/adLayout";
import type { BoardItem } from "../../types";
import {
  type FrameGuideSet,
  guidesOf,
  isOffFrame,
  settleGuide,
  withGuides,
} from "./frameGuides";
import "./FrameGuides.css";

/**
 * Guides over the artboard, the way a design tool has them.
 *
 * Drag from the ruler above the frame for a horizontal guide, or from the one
 * on its left for a vertical one; drag a guide to move it, off the frame or
 * double-click it to take it away. Layers snap to them (snap.ts) and they're
 * kept on the frame (frameGuides.ts).
 *
 * A frame made at a social size also shows where that platform crops it or
 * draws over it (config/socialSizes.ts). The button where the rulers meet
 * hides that for this frame.
 *
 * Drawn on screen beside the scaled board, not inside it, so the rulers can
 * sit outside the frame and nothing here can end up in an export.
 */

type Axis = "x" | "y";

interface Dragging {
  at: number;
  axis: Axis;
  /** Which guide is moving; null for a new one off a ruler. */
  index: number | null;
}

/** How close, on screen, a guide must come to the middle to settle there. */
const SETTLE_PX = 6;

const pct = (n: number) => `${n * 100}%`;

export interface FrameGuidesProps {
  frame: BoardItem;
  onCommit: (id: string, patch: Partial<BoardItem>) => void;
  scale: number;
}

export function FrameGuides({ frame, onCommit, scale }: FrameGuidesProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setShown] = useState<Dragging | null>(null);
  // The latest drag, for the next pointer event before React has re-rendered.
  const current = useRef<Dragging | null>(null);
  const setDragging = (next: Dragging | null) => {
    current.current = next;
    setShown(next);
  };
  const set = guidesOf(frame);
  const size = sizeOfTitle(frame.body);
  const px = sizeFromTitle(frame.body) ?? { h: frame.height, w: frame.width };
  const width = frame.width * scale;
  const height = frame.height * scale;

  const save = (next: FrameGuideSet) =>
    onCommit(frame.id, withGuides(frame, next));

  const fractionAt = (axis: Axis, e: { clientX: number; clientY: number }) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!(rect?.width && rect.height)) {
      return 0;
    }
    return axis === "x"
      ? (e.clientX - rect.left) / rect.width
      : (e.clientY - rect.top) / rect.height;
  };

  const start = (axis: Axis, index: number | null, e: ReactPointerEvent) => {
    if (e.button !== 0) {
      return;
    }
    // Not a press on the stage: that would deselect and start a marquee.
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging({ at: fractionAt(axis, e), axis, index });
  };

  const move = (e: ReactPointerEvent) => {
    const was = current.current;
    if (!was) {
      return;
    }
    const extent = was.axis === "x" ? width : height;
    const at = fractionAt(was.axis, e);
    setDragging({ ...was, at: settleGuide(at, SETTLE_PX / extent) });
  };

  const end = () => {
    const was = current.current;
    if (!was) {
      return;
    }
    const { at, axis, index } = was;
    setDragging(null);
    const rest = set[axis].filter((_, i) => i !== index);
    save({ ...set, [axis]: isOffFrame(at) ? rest : [...rest, at] });
  };

  const remove = (axis: Axis, index: number) =>
    save({ ...set, [axis]: set[axis].filter((_, i) => i !== index) });

  // The guide being moved stays the same element, drawn where it's going:
  // it holds the pointer, and an element taken away mid-drag loses it.
  const placed = (axis: Axis) =>
    set[axis].map((at, index) =>
      dragging?.axis === axis && dragging.index === index
        ? { at: dragging.at, index, moving: true }
        : { at, index, moving: false }
    );

  const readout = dragging
    ? `${Math.round(dragging.at * (dragging.axis === "x" ? px.w : px.h))} px`
    : "";

  return (
    <div
      className="frame-guides"
      data-testid="frame-guides"
      onPointerCancel={end}
      onPointerMove={move}
      onPointerUp={end}
      ref={ref}
      style={{ height, width }}
    >
      {size?.safe && !set.hideSafe ? (
        <SafeOverlay safe={size.safe} size={size} />
      ) : null}
      <div
        className="frame-guides__ruler frame-guides__ruler--top"
        onPointerDown={(e) => start("y", null, e)}
        title="Drag down for a horizontal guide"
      />
      <div
        className="frame-guides__ruler frame-guides__ruler--left"
        onPointerDown={(e) => start("x", null, e)}
        title="Drag across for a vertical guide"
      />
      {size?.safe ? (
        <button
          aria-label={set.hideSafe ? "Show safe zone" : "Hide safe zone"}
          aria-pressed={!set.hideSafe}
          className="frame-guides__toggle"
          onClick={() => save({ ...set, hideSafe: !set.hideSafe })}
          onPointerDown={(e) => e.stopPropagation()}
          title={`${set.hideSafe ? "Show" : "Hide"} the ${size.group} safe zone`}
          type="button"
        >
          <HugeiconsIcon aria-hidden icon={CropIcon} size={12} />
        </button>
      ) : null}
      {(["x", "y"] as const).flatMap((axis) =>
        placed(axis).map((g) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: a guide is dragged with the pointer; layers have the keyboard route
          // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same
          <div
            className={`frame-guides__guide frame-guides__guide--${axis}`}
            data-leaving={g.moving && isOffFrame(g.at) ? "" : undefined}
            key={`${axis}${g.index}`}
            onDoubleClick={() => remove(axis, g.index)}
            onPointerDown={(e) => start(axis, g.index, e)}
            style={axis === "x" ? { left: pct(g.at) } : { top: pct(g.at) }}
            title="Drag to move; drag off the frame or double-click to remove"
          >
            {g.moving ? (
              <span className="frame-guides__readout">{readout}</span>
            ) : null}
          </div>
        ))
      )}
      {dragging?.index === null && !isOffFrame(dragging.at) ? (
        <div
          className={`frame-guides__guide frame-guides__guide--${dragging.axis} frame-guides__guide--live`}
          style={
            dragging.axis === "x"
              ? { left: pct(dragging.at) }
              : { top: pct(dragging.at) }
          }
        >
          <span className="frame-guides__readout">{readout}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Where the platform crops the picture or draws over it, shaded. */
function SafeOverlay({
  safe,
  size,
}: {
  safe: SafeZone;
  size: { h: number; w: number };
}) {
  const { inset } = safe;
  return (
    <div aria-hidden className="frame-guides__safe">
      {safe.round ? (
        <span className="frame-guides__circle">
          <span className="frame-guides__note">{safe.note}</span>
        </span>
      ) : null}
      {inset ? (
        <span
          className="frame-guides__zone"
          style={{
            height: pct((size.h - inset.top - inset.bottom) / size.h),
            left: pct(inset.left / size.w),
            top: pct(inset.top / size.h),
            width: pct((size.w - inset.left - inset.right) / size.w),
          }}
        >
          <span className="frame-guides__note">{safe.note}</span>
        </span>
      ) : null}
      {safe.covers?.map((c) => (
        <span
          className="frame-guides__cover"
          data-round={c.round ? "" : undefined}
          key={c.label}
          style={{
            height: pct(c.h / size.h),
            left: pct(c.x / size.w),
            top: pct(c.y / size.h),
            width: pct(c.w / size.w),
          }}
        >
          <span className="frame-guides__note">{c.label}</span>
        </span>
      ))}
    </div>
  );
}
