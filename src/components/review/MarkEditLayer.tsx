import {
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  useRef,
} from "react";
import type { ReviewMark } from "../../../config/review.js";
import {
  handleIndexes,
  moveMark,
  movePoint,
} from "../../../config/reviewMarkEdit.js";
import { markStroke, Shape } from "./ReviewMarkup";

/**
 * Handles on the selected mark, so a mark can be changed after it is drawn:
 * drag the mark to move it, drag an end (an arrow's tail or tip, a box's
 * corner) to reshape it. Shared by the review editor and the board's Browser
 * node.
 *
 * `onChange` follows the drag, for drawing; `onCommit` gets the result once,
 * on release, so a whole drag is one undo step and one save.
 */
export function MarkEditLayer({
  height,
  mark,
  onChange,
  onCommit,
  surface,
  width,
}: {
  height: number;
  mark: ReviewMark;
  onChange: (mark: ReviewMark) => void;
  onCommit: (mark: ReviewMark) => void;
  /** The picture's box, which pointer positions are read against. */
  surface: RefObject<HTMLElement | null>;
  width: number;
}) {
  const drag = useRef<{
    from: { x: number; y: number };
    index: number | null;
    latest: ReviewMark;
    start: ReviewMark;
  } | null>(null);

  const at = (e: PointerEvent) => {
    const box = surface.current?.getBoundingClientRect();
    return box?.width && box.height
      ? {
          x: (e.clientX - box.left) / box.width,
          y: (e.clientY - box.top) / box.height,
        }
      : null;
  };

  const begin = (index: number | null) => (e: PointerEvent<SVGElement>) => {
    const from = at(e);
    if (e.button !== 0 || !from) {
      return;
    }
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { from, index, latest: mark, start: mark };
  };

  const follow = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const to = at(e);
    if (!(d && to)) {
      return;
    }
    d.latest =
      d.index === null
        ? moveMark(d.start, to.x - d.from.x, to.y - d.from.y)
        : movePoint(d.start, d.index, to);
    onChange(d.latest);
  };

  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d && d.latest !== d.start) {
      onCommit(d.latest);
    }
  };

  const stroke = markStroke(width);
  const radius = stroke * 3;
  return (
    // Hidden from assistive tech like the marks it edits; the eraser,
    // Delete and undo cover the keyboard.
    <svg
      aria-hidden
      className="review-mark-edit"
      onClick={(e) => e.stopPropagation()}
      onPointerCancel={end}
      onPointerMove={follow}
      onPointerUp={end}
      preserveAspectRatio="none"
      style={{ "--review-hit": `${stroke * 8}px` } as CSSProperties}
      viewBox={`0 0 ${width} ${height}`}
    >
      <g className="review-mark-edit__body" onPointerDown={begin(null)}>
        <Shape height={height} mark={mark} stroke={stroke} width={width} />
      </g>
      {handleIndexes(mark).map((index) => {
        const [x, y] = mark.points[index] ?? [0, 0];
        return (
          <circle
            className="review-mark-edit__handle"
            cx={x * width}
            cy={y * height}
            key={index}
            onPointerDown={begin(index)}
            r={radius}
            strokeWidth={stroke * 0.75}
          />
        );
      })}
    </svg>
  );
}
