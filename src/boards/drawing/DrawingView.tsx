import { useId } from "react";
import {
  CORNER_RADIUS,
  type DrawingConfig,
  isFreehand,
  isTransparent,
  pathFor,
} from "./drawing";
import {
  borderSidesOf,
  borderStrips,
  fillImageOf,
  isPartialBorder,
} from "./shapePaint";
import { type ShapeGeometry, shapeGeometry } from "./shapes";
import "./DrawingView.css";

/**
 * A drawn mark, rendered as SVG inside its own item box.
 *
 * The SVG uses a 0–1 viewBox and non-scaling geometry so the drawing fills
 * whatever size the item has been dragged to. That is what makes a stroke
 * resizable at all: the points were stored in unit space precisely so this
 * could happen without rewriting them.
 *
 * `preserveAspectRatio="none"` on purpose — stretching a drawing when its box
 * is stretched is what a person dragging a corner means. Refusing to stretch
 * would leave the mark floating inside a box that no longer fits it.
 *
 * A closed shape can also be filled with a Studio picture, and a box can have
 * its border on only some sides (shapePaint.ts).
 */

interface DrawingViewProps {
  config: DrawingConfig;
  /** Item size in canvas units, so the stroke keeps a constant weight. */
  height: number;
  width: number;
}

/** How a closed shape is painted, worked out once for whichever outline. */
interface Paint {
  /** The colour fill, or "none". */
  colour: string;
  /** The id of the picture pattern, when there's a Studio picture. */
  pictureId: string | null;
}

const viewBoxOf = (width: number, height: number) =>
  `0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`;

/** The Studio picture, covering the whole box like an image layer. */
function PictureDefs({
  height,
  id,
  url,
  width,
}: {
  height: number;
  id: string;
  url: string;
  width: number;
}) {
  return (
    <defs>
      <pattern
        height={height}
        id={id}
        patternUnits="userSpaceOnUse"
        width={width}
      >
        <image
          height={height}
          href={url}
          preserveAspectRatio="xMidYMid slice"
          width={width}
        />
      </pattern>
    </defs>
  );
}

/** The colour, then the picture over it where the shape is filled. */
const fills = (paint: Paint): string[] =>
  paint.pictureId ? [paint.colour, `url(#${paint.pictureId})`] : [paint.colour];

function FreehandView({ config, height, width }: DrawingViewProps) {
  const unitPoints = config.points ?? [];
  if (unitPoints.length === 0) {
    return null;
  }
  // Scaled back into canvas units rather than drawn in a 0–1 viewBox. The
  // unit box seemed tidier, but it forced the stroke width to be divided by
  // the item's size to stay constant — and combining that with
  // non-scaling-stroke corrected the same thing twice in opposite
  // directions, rendering every mark about three hundred times too thin.
  //
  // In canvas units the width is simply the width, identical to the value the
  // live preview draws with, which is the only way the two can agree.
  const points = unitPoints.map((point) => ({
    x: point.x * width,
    y: point.y * height,
  }));
  return (
    <svg
      className="drawing-view"
      preserveAspectRatio="none"
      viewBox={viewBoxOf(width, height)}
    >
      <title>Drawing</title>
      <path
        d={pathFor(points, config.tool === "brush")}
        fill="none"
        stroke={config.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={Math.max(0, config.strokeWidth)}
      />
    </svg>
  );
}

/** A triangle, polygon, star, squircle or line (shapes.ts). */
function PathShape({
  config,
  paint,
  shape,
}: {
  config: DrawingConfig;
  paint: Paint;
  shape: ShapeGeometry;
}) {
  const strokeWidth = Math.max(0, config.strokeWidth);
  const layers = shape.closed ? fills(paint) : ["none"];
  return (
    <>
      {layers.map((fill, i) => (
        <path
          d={shape.d}
          fill={fill}
          key={fill}
          stroke={
            i === layers.length - 1 && strokeWidth > 0 ? config.stroke : "none"
          }
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      ))}
      {shape.head ? <path d={shape.head} fill={config.stroke} /> : null}
    </>
  );
}

/** A rectangle, rounded rectangle or ellipse. */
function BoxShape({
  clipId,
  config,
  height,
  paint,
  width,
}: DrawingViewProps & { clipId: string; paint: Paint }) {
  const strokeWidth = Math.max(0, config.strokeWidth);
  const defaultRadius = config.tool === "rounded" ? CORNER_RADIUS : 0;
  const radius =
    typeof config.radius === "number"
      ? Math.min(config.radius, width / 2, height / 2)
      : defaultRadius;
  // Some sides only: the fill runs to the box's edges and the border is laid
  // inside them as bands, trimmed to the corners. All round, the outline is
  // inset by half the stroke so it sits inside the box rather than straddling
  // its edge and being clipped.
  const partial = isPartialBorder(config);
  const inset = partial ? 0 : strokeWidth / 2;
  const line = !partial && strokeWidth > 0 ? config.stroke : "none";
  const layers = fills(paint);
  const strips = partial
    ? borderStrips(borderSidesOf(config), width, height, strokeWidth)
    : [];
  return (
    <>
      {strips.length > 0 ? (
        <clipPath id={clipId}>
          <rect height={height} rx={radius} width={width} />
        </clipPath>
      ) : null}
      {layers.map((fill, i) => {
        const stroke = i === layers.length - 1 ? line : "none";
        return config.tool === "ellipse" ? (
          <ellipse
            cx={width / 2}
            cy={height / 2}
            fill={fill}
            key={fill}
            rx={Math.max(width / 2 - inset, 0)}
            ry={Math.max(height / 2 - inset, 0)}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        ) : (
          <rect
            fill={fill}
            height={Math.max(height - inset * 2, 0)}
            key={fill}
            rx={radius}
            stroke={stroke}
            strokeWidth={strokeWidth}
            width={Math.max(width - inset * 2, 0)}
            x={inset}
            y={inset}
          />
        );
      })}
      {strips.length > 0 ? (
        <g clipPath={`url(#${clipId})`} data-border="" fill={config.stroke}>
          {strips.map((s) => (
            <rect
              height={s.h}
              key={`${s.x}:${s.y}:${s.w}`}
              width={s.w}
              x={s.x}
              y={s.y}
            />
          ))}
        </g>
      ) : null}
    </>
  );
}

export function DrawingView({ config, height, width }: DrawingViewProps) {
  // Ids for this shape's picture fill and border clip: unique on the page,
  // since every shape on the board is its own SVG with its own defs.
  const uid = useId().replaceAll(":", "");
  if (isFreehand(config.tool)) {
    return <FreehandView config={config} height={height} width={width} />;
  }
  const picture = fillImageOf(config);
  const paint: Paint = {
    // A fully transparent fill is the default and means "no fill"; passing it
    // to SVG as a color would work but "none" is what it actually is.
    colour: isTransparent(config.fill) ? "none" : (config.fill ?? "none"),
    pictureId: picture ? `shape-fill-${uid}` : null,
  };
  const opacity =
    typeof config.opacity === "number" && config.opacity < 1
      ? Math.max(0, config.opacity)
      : undefined;
  const shape = shapeGeometry(
    config,
    width,
    height,
    Math.max(0, config.strokeWidth)
  );
  return (
    <svg
      className="drawing-view"
      opacity={opacity}
      viewBox={viewBoxOf(width, height)}
    >
      <title>Drawing</title>
      {picture && paint.pictureId ? (
        <PictureDefs
          height={height}
          id={paint.pictureId}
          url={picture}
          width={width}
        />
      ) : null}
      {shape ? (
        <PathShape config={config} paint={paint} shape={shape} />
      ) : (
        <BoxShape
          clipId={`shape-clip-${uid}`}
          config={config}
          height={height}
          paint={paint}
          width={width}
        />
      )}
    </svg>
  );
}
