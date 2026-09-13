import type { Anchor, MarkPaths } from "./bezierPaths";
import { countOf } from "./bezierPaths";
import { ground } from "./drawMark";

/**
 * The drawing under the drawing.
 *
 * Anchors as squares, control points as circles, and a thin line from each
 * anchor to its handles — the view a designer works in, which no rendering of
 * the finished mark can show. A count underneath, because "a hundred and
 * twenty three points" is a fact about the artwork that nobody can eyeball.
 *
 * Vector only. A raster mark has no anchors, and drawing something anyway
 * would be the one failure this tile exists to prevent.
 */

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const ANCHOR = 5;
const HANDLE = 3.5;

const say = (
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number
): void => {
  ctx.fillStyle = "#6a6a6a";
  ctx.font = `${Math.round(size * 0.02)}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillText(text, size / 2, size * 0.93);
  ctx.textAlign = "left";
};

/** The curve itself, segment by segment, from each anchor's handles. */
const strokePath = (
  ctx: CanvasRenderingContext2D,
  path: Anchor[],
  at: (point: { x: number; y: number }) => { x: number; y: number }
): void => {
  const [first, ...rest] = path;
  if (!first) {
    return;
  }
  ctx.beginPath();
  const start = at(first);
  ctx.moveTo(start.x, start.y);
  let previous = first;
  for (const anchor of rest) {
    const to = at(anchor);
    if (previous.out && anchor.in) {
      const a = at(previous.out);
      const b = at(anchor.in);
      ctx.bezierCurveTo(a.x, a.y, b.x, b.y, to.x, to.y);
    } else if (anchor.in) {
      const b = at(anchor.in);
      ctx.quadraticCurveTo(b.x, b.y, to.x, to.y);
    } else {
      ctx.lineTo(to.x, to.y);
    }
    previous = anchor;
  }
  ctx.stroke();
};

export const drawBezier = (
  ctx: CanvasRenderingContext2D,
  size: number,
  marks: MarkPaths | null
): void => {
  ground(ctx, "#f1f1ef", { height: size, width: size });
  if (!marks || marks.paths.length === 0) {
    ctx.fillStyle = "#8a8a8a";
    ctx.font = `${Math.round(size * 0.022)}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.fillText("This mark is not vector artwork", size / 2, size / 2);
    ctx.textAlign = "left";
    return;
  }

  const pad = size * 0.12;
  const room = size - pad * 2 - size * 0.08;
  const scale = Math.min(
    room / marks.viewBox.width,
    room / marks.viewBox.height
  );
  const offsetX = (size - marks.viewBox.width * scale) / 2;
  const offsetY = pad;
  const at = (point: { x: number; y: number }) => ({
    x: offsetX + point.x * scale,
    y: offsetY + point.y * scale,
  });

  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  for (const path of marks.paths) {
    strokePath(ctx, path, at);
  }

  /*
   * Handles first, anchors over them.
   *
   * A handle line crossing an anchor should pass behind it — the anchor is
   * the thing being described and the handle is how, so the order says which
   * is which without needing a legend.
   */
  ctx.strokeStyle = "#b4b4b4";
  for (const path of marks.paths) {
    for (const anchor of path) {
      const point = at(anchor);
      for (const control of [anchor.in, anchor.out]) {
        if (!control) {
          continue;
        }
        const handle = at(control);
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(handle.x, handle.y);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, HANDLE, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  ctx.fillStyle = "#1a1a1a";
  for (const path of marks.paths) {
    for (const anchor of path) {
      const point = at(anchor);
      ctx.fillRect(point.x - ANCHOR / 2, point.y - ANCHOR / 2, ANCHOR, ANCHOR);
    }
  }

  const counted = countOf(marks.paths);
  say(
    ctx,
    `${counted.paths} paths · ${counted.points} pts · ${counted.handles} handles`,
    size
  );
};
