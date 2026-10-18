import type { CSSProperties, MouseEvent } from "react";
import type { PinKind, ReviewMark } from "../../../config/review.js";
import { contrastRatio, isHexColor } from "../../../config/theme.js";
import "./reviewMarkup.css";

/**
 * Markup over a review screenshot, drawn the same way in the admin editor and
 * on the page the client reads.
 *
 * One SVG in the image's own coordinates (its pixel width and height), laid
 * over the picture and stretched with it, so a box drawn around a button stays
 * around that button at any size. Everything is in the site's accent colour —
 * see reviewAccentStyle — so a review reads as coming from this studio rather
 * than from a generic annotation tool.
 */

/** Ink on the accent: whichever of black or white reads better against it. */
const onAccent = (accent: string): string =>
  contrastRatio(accent, "#ffffff") >= contrastRatio(accent, "#111111")
    ? "#ffffff"
    : "#111111";

/**
 * The CSS variables every review surface reads its colours from.
 *
 * Set on the review's root element from the site settings, rather than relying
 * on the global --accent, which the admin chrome and the board both redefine.
 */
export const reviewAccentStyle = (accent: string): CSSProperties => {
  const colour = isHexColor(accent) ? accent : "#7c7f01";
  return {
    "--review-accent": colour,
    "--review-on-accent": onAccent(colour),
  } as CSSProperties;
};

/** The class a pin of this kind wears, on either surface. */
export const reviewPinClass = (kind: PinKind): string =>
  `review-pin review-pin--${kind}`;

const rectOf = ([a, b]: [number, number][], width: number, height: number) => {
  const [x1, y1] = a ?? [0, 0];
  const [x2, y2] = b ?? [0, 0];
  return {
    height: Math.abs(y2 - y1) * height,
    width: Math.abs(x2 - x1) * width,
    x: Math.min(x1, x2) * width,
    y: Math.min(y1, y2) * height,
  };
};

function Shape({
  height,
  mark,
  stroke,
  width,
}: {
  height: number;
  mark: ReviewMark;
  stroke: number;
  width: number;
}) {
  const pts = mark.points.map(([x, y]) => [x * width, y * height] as const);
  if (mark.kind === "box") {
    return (
      <rect
        {...rectOf(mark.points, width, height)}
        className="review-markup__box"
        rx={stroke * 1.5}
        strokeWidth={stroke}
      />
    );
  }
  if (mark.kind === "highlight") {
    return (
      <rect
        {...rectOf(mark.points, width, height)}
        className="review-markup__highlight"
        rx={stroke}
      />
    );
  }
  if (mark.kind === "arrow") {
    const [from, to] = pts;
    return (
      <line
        className="review-markup__arrow"
        markerEnd="url(#review-arrowhead)"
        strokeWidth={stroke}
        x1={from?.[0]}
        x2={to?.[0]}
        y1={from?.[1]}
        y2={to?.[1]}
      />
    );
  }
  return (
    <polyline
      className="review-markup__pen"
      points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
      strokeWidth={stroke}
    />
  );
}

export function ReviewMarks({
  draft,
  height,
  marks,
  onSelect,
  selected,
  width,
}: {
  /** A mark being drawn, shown but not yet saved. */
  draft?: ReviewMark | null;
  height: number;
  marks: ReviewMark[];
  /** When given, marks can be clicked to select them (the editor). */
  onSelect?: (id: string) => void;
  selected?: string | null;
  width: number;
}) {
  if (marks.length === 0 && !draft) {
    return null;
  }
  // Proportional to the picture, so a stroke reads the same on a phone
  // capture and a desktop one.
  const stroke = Math.max(2, width * 0.0035);
  const shown = draft ? [...marks, draft] : marks;
  return (
    <svg
      aria-hidden
      className={`review-markup ${onSelect ? "review-markup--editable" : ""}`}
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <marker
          id="review-arrowhead"
          markerHeight="4"
          markerWidth="4"
          orient="auto-start-reverse"
          refX="2.5"
          refY="2"
        >
          <path className="review-markup__head" d="M0,0 L4,2 L0,4 Z" />
        </marker>
      </defs>
      {shown.map((mark) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: SVG markup; deletion is also available from the toolbar
        <g
          className={`review-markup__mark ${selected === mark.id ? "review-markup__mark--selected" : ""}`}
          key={mark.id}
          onClick={
            onSelect
              ? (e: MouseEvent) => {
                  e.stopPropagation();
                  onSelect(mark.id);
                }
              : undefined
          }
          onKeyDown={undefined}
        >
          <Shape height={height} mark={mark} stroke={stroke} width={width} />
        </g>
      ))}
    </svg>
  );
}
