import { coverGlOptionsFrom, CoverGlError, paintCover } from "./coverGl";
import {
  type CoverLayout,
  type CoverVariant,
  COVER_HEIGHT,
  COVER_WIDTH,
  coverLayout,
  type Run,
  wordsFromText,
} from "./coverLayout";
import { loadImage } from "./halftoneGl";

/**
 * Rendering a Cover node to a file.
 *
 * Two surfaces, one canvas. The artwork and the finishing stack are drawn by
 * WebGL into an offscreen canvas; that canvas is then drawn into a 2D one and
 * the words are set on top with `fillText`. The 2D canvas is what leaves here.
 *
 * It has to be that way round, and the reason is in captureCanvas.ts: a capture
 * takes the *last* canvas in its host. A WebGL canvas with a DOM overlay above
 * it captures the picture and loses every word on the cover. One canvas holding
 * both is the only arrangement that cannot silently drop the type.
 *
 * Type is set with canvas2d rather than in the shader because a shader has no
 * font metrics. It is also why `document.fonts.load` is awaited first — a
 * `fillText` before the face has loaded renders in the fallback and says
 * nothing about having done so, which is worse than failing.
 */

export type CoverSettings = Record<string, unknown>;

/** Seed for the grain, from the artwork's address, so a re-render matches. */
const seedFrom = (url: string): number => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 1000);
};

const text = (value: unknown): string =>
  typeof value === "string" ? value : "";

const color = (value: unknown, fallback: string): string =>
  typeof value === "string" && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.trim())
    ? value.trim()
    : fallback;

/**
 * Waits for the faces the layout asks for.
 *
 * Failure is swallowed on purpose. A missing face is a cover set in the
 * fallback, which is visibly wrong and recoverable; a thrown error is no cover
 * at all. The console line is there so it is diagnosable rather than mysterious.
 */
const loadFaces = async (layout: CoverLayout): Promise<void> => {
  if (!document.fonts) {
    return;
  }
  const wanted = new Set(layout.runs.map((run) => `700 100px ${run.face}`));
  await Promise.all(
    [...wanted].map((spec) =>
      document.fonts.load(spec).catch((err: unknown) => {
        console.warn("[cover] font did not load:", spec, err);
      })
    )
  );
  await document.fonts.ready;
};

/**
 * One run, tracked.
 *
 * Canvas2d has `letterSpacing` but only in recent Chromium and it is ignored
 * where it is unsupported — silently, which would make a tracked Horizon title
 * come out tight on some machines and right on others. Drawing glyph by glyph
 * is a few more lines and behaves the same everywhere.
 */
const drawRun = (
  ctx: CanvasRenderingContext2D,
  run: Run,
  scale: number
): void => {
  ctx.save();
  ctx.globalAlpha = run.opacity;
  ctx.fillStyle = run.fill;
  ctx.font = `${run.size * scale}px ${run.face}`;
  ctx.textBaseline = "alphabetic";

  const tracking = run.tracking * scale;
  const glyphs = [...run.text];
  const width =
    glyphs.reduce((sum, g) => sum + ctx.measureText(g).width, 0) +
    tracking * Math.max(0, glyphs.length - 1);

  let x =
    run.align === "center"
      ? (run.x + run.width / 2) * scale - width / 2
      : run.x * scale;

  for (const glyph of glyphs) {
    ctx.fillText(glyph, x, run.baseline * scale);
    x += ctx.measureText(glyph).width + tracking;
  }
  ctx.restore();
};

/**
 * A PNG of the cover.
 *
 * No polling and no timeout: once the artwork has loaded every step here is
 * synchronous, so there is no window in which a capture lands early and comes
 * back blank. renderOffscreen exists for the React shader nodes, which do have
 * that window; this one does not need it.
 */
export const renderCover = async (
  config: CoverSettings,
  artUrl: string | null,
  wired: string | null,
  width = COVER_WIDTH
): Promise<Blob> => {
  if (!artUrl) {
    throw new CoverGlError("Wire a picture into this node to make a cover.");
  }

  const scale = width / COVER_WIDTH;
  const height = Math.round(COVER_HEIGHT * scale);

  const image = await loadImage(artUrl);

  const fromWire = wordsFromText(wired);
  const layout = coverLayout(
    config.variant === "horizon" ? "horizon" : ("poster" as CoverVariant),
    {
      // Settings win over the wire, so a node can override one line without
      // detaching what feeds it.
      author: text(config.author) || fromWire.author || "",
      subtitle: text(config.subtitle) || fromWire.subtitle || "",
      title: text(config.title) || fromWire.title || "",
    },
    {
      accent: color(config.accent, "#fa7c62"),
      band: color(config.band, "#293341"),
      ink: color(config.ink, "#efe6d2"),
    },
    (sample, face) => {
      // The measurer the layout asks for: one glyph run at 1px, on a scratch
      // context, so the pure module never touches a canvas itself.
      const scratch = document.createElement("canvas").getContext("2d");
      if (!scratch) {
        return 0;
      }
      scratch.font = `100px ${face}`;
      return scratch.measureText(sample).width / 100;
    }
  );

  await loadFaces(layout);

  const gl = document.createElement("canvas");
  gl.width = width;
  gl.height = height;
  paintCover(gl, image, coverGlOptionsFrom(config, seedFrom(artUrl)));

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) {
    throw new CoverGlError("This browser cannot draw the cover.");
  }
  ctx.drawImage(gl, 0, 0);

  if (layout.band) {
    ctx.fillStyle = layout.band.fill;
    ctx.fillRect(0, 0, width, Math.round(layout.band.height * scale));
  }
  for (const run of layout.runs) {
    drawRun(ctx, run, scale);
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    out.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new CoverGlError("The cover could not be saved as a picture.");
  }
  return blob;
};
