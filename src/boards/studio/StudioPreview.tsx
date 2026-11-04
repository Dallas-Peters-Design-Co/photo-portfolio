import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageTool, RenderContext, StudioValues } from "./types";

/**
 * The live picture in a Studio tool.
 *
 * A tool that can `draw` is drawn straight onto a canvas at the size it shows
 * on screen (the browser draws a 2D canvas on the GPU), once per frame at
 * most however fast a slider moves. Building the whole SVG, escaping it into a
 * data URL and having the browser decode it on every change is what made a
 * mosaic of thousands of tiles stutter; the SVG is now made only when it's
 * needed, to go on the board or be downloaded.
 */
export function StudioPreview({
  ctx,
  tool,
  values,
}: {
  ctx: RenderContext;
  tool: ImageTool;
  values: StudioValues;
}) {
  if (!tool.draw) {
    return <SvgPreview ctx={ctx} tool={tool} values={values} />;
  }
  return <CanvasPreview ctx={ctx} tool={tool} values={values} />;
}

function SvgPreview({
  ctx,
  tool,
  values,
}: {
  ctx: RenderContext;
  tool: ImageTool;
  values: StudioValues;
}) {
  const src = useMemo(
    () =>
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tool.render(values, ctx))}`,
    [tool, values, ctx]
  );
  return (
    <img
      alt={`${tool.name} preview`}
      height={ctx.height}
      src={src}
      width={ctx.width}
    />
  );
}

/** How many canvas pixels the preview needs: its box on screen, not the full size. */
const useResolution = (
  ref: React.RefObject<HTMLCanvasElement | null>,
  w: number,
  h: number
) => {
  const [k, setK] = useState(0);
  useEffect(() => {
    const box = ref.current?.parentElement;
    if (!box) {
      return;
    }
    const measure = () => {
      const dpr = window.devicePixelRatio || 1;
      const fit = Math.min(box.clientWidth / w, box.clientHeight / h) * dpr;
      // Never more than the picture itself, never so few it's mush.
      setK(Math.max(0.05, Math.min(1, fit || 1)));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(box);
    return () => watch.disconnect();
  }, [ref, w, h]);
  return k;
};

function CanvasPreview({
  ctx,
  tool,
  values,
}: {
  ctx: RenderContext;
  tool: ImageTool;
  values: StudioValues;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const k = useResolution(ref, ctx.width, ctx.height);
  const pw = Math.max(1, Math.round(ctx.width * k));
  const ph = Math.max(1, Math.round(ctx.height * k));

  useEffect(() => {
    const canvas = ref.current;
    // Drawn once the canvas has taken its new size, which clears it.
    if (!(canvas && k) || canvas.width !== pw || canvas.height !== ph) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const g = canvas.getContext("2d");
      if (!g) {
        return;
      }
      tool.draw?.(g, values, ctx);
    });
    return () => cancelAnimationFrame(frame);
  }, [tool, values, ctx, k, pw, ph]);

  return (
    <canvas
      aria-label={`${tool.name} preview`}
      height={ph}
      ref={ref}
      role="img"
      width={pw}
    />
  );
}
