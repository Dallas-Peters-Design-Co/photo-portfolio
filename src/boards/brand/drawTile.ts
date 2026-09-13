import type { MarkPaths } from "./bezierPaths";
import { drawBezier } from "./drawBezier";
import { caption, fitted, ground, inked } from "./drawMark";
import { reliefOf } from "./drawRelief";
import { drawCard, drawFavicon, drawOnPhoto } from "./drawStationery";
import type { ProofTile } from "./proofTiles";
import { TEMPLATES } from "./templates";

/**
 * One tile, drawn.
 *
 * Each branch is a test rather than a picture: it puts the mark in a place it
 * will really be met and lets the mark fail there. The captions are written in
 * proofTiles.ts; this is only the pixels.
 *
 * Everything draws at one size so the tiles compare cleanly on a board, and
 * nothing here is generated — no model, no cost, no waiting. That is the whole
 * reason the sheet can be re-run every time a mark changes.
 */

export const TILE = 640;

/**
 * How many real pixels each tile pixel is drawn with.
 *
 * Every layout number in this file is in tile units, and the tile is sized so
 * a sheet of them compares cleanly — but a client viewing a proof sheet zooms
 * in, and at 640 real pixels a tile turns to mush the moment they do. The
 * caption went blocky before the artwork did, which is the tell that it was
 * the canvas and not the mark.
 *
 * So the canvas is drawn at twice the size and the context scaled to match.
 * Nothing else in the file changes, the ramp still measures in real placement
 * pixels, and every tile is now worth zooming into.
 */
const SCALE = 2;

/** The tile's real pixel size, which is what the drawn canvas measures. */
export const TILE_PX = TILE * SCALE;

/** Loaded artwork, with its own pixel size. */
export type Mark = CanvasImageSource & { height: number; width: number };

const PAD = 80;
const inner = () => ({
  height: TILE - PAD * 2,
  width: TILE - PAD * 2,
  x: PAD,
  y: PAD,
});

type Draw = (
  ctx: CanvasRenderingContext2D,
  mark: Mark,
  tile: ProofTile,
  context: TileContext
) => void;

/**
 * The ramp, laid out to fit the tile it is drawn on.
 *
 * The sizes are real pixel counts and that is the point of the tile, so they
 * are never scaled. What was missing was a check that they add up: the ramp
 * ran to 512, the widths and gaps came to over nine hundred, and the largest
 * two simply walked off the right edge of the frame — the tile looked broken
 * because half of it was outside the picture.
 *
 * Sizes that do not fit are dropped from the right, with the tile saying so
 * rather than silently showing a shorter ramp. The gap shrinks first, because
 * losing a placement is worse than losing some air between them.
 */
const RAMP_GAP = 18;

const rampFits = (
  sizes: readonly { px: number }[],
  room: number
): readonly { px: number }[] => {
  let kept = sizes.length;
  const total = (count: number) =>
    sizes
      .slice(0, count)
      .reduce((sum, size) => sum + size.px + RAMP_GAP, -RAMP_GAP);
  while (kept > 1 && total(kept) > room) {
    kept -= 1;
  }
  return sizes.slice(0, kept);
};

const drawScale: Draw = (ctx, mark, tile, { minWidth }) => {
  const all = tile.sizes ?? [];
  const room = TILE - PAD * 2;
  // Nothing taller than the tile either: a 512-pixel square does not fit in a
  // 480-pixel band however much room there is beside it.
  const sizes = rampFits(
    all.filter((size) => size.px <= room),
    room
  );
  let x = PAD;
  const baseline = TILE - PAD;
  for (const size of sizes) {
    const box = fitted(mark, {
      height: size.px,
      width: size.px,
      x,
      y: baseline - size.px,
    });
    ctx.drawImage(mark, box.x, box.y, box.width, box.height);
    ctx.fillStyle = "#8a8a8a";
    ctx.font = "10px ui-monospace, monospace";
    // Centred under the artwork, not under its slot. A portrait mark in a
    // square slot sits in the middle of it, and a label pinned to the slot's
    // left edge then points at empty space beside the mark it names.
    ctx.textAlign = "center";
    ctx.fillText(`${size.px}`, box.x + box.width / 2, baseline + 16);
    ctx.textAlign = "left";
    x += size.px + RAMP_GAP;
  }
  if (sizes.length < all.length) {
    // Right-aligned on its own line. Following the ramp put it wherever the
    // last size happened to end, which for a long ramp is off the edge — the
    // note about what does not fit did not fit.
    ctx.fillStyle = "#8a8a8a";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(
      `+ ${all.length - sizes.length} larger than this frame`,
      TILE - PAD,
      baseline + 34
    );
    ctx.textAlign = "left";
  }
  /*
   * The line the kit drew itself.
   *
   * Everything left of it is narrower than the width the brand declares the
   * mark stops working at — so a sheet where the line sits past the first two
   * sizes is the kit admitting it has no favicon.
   */
  const at = PAD + minWidth;
  ctx.strokeStyle = "#d1453f";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(at, PAD);
  ctx.lineTo(at, baseline + 4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#d1453f";
  ctx.fillText(`min ${minWidth}px`, at + 6, PAD);
};

const drawPattern: Draw = (ctx, mark) => {
  const step = TILE / 5;
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const offset = row % 2 === 0 ? 0 : step / 2;
      const box = fitted(mark, {
        height: step * 0.55,
        width: step * 0.55,
        x: column * step + offset - step / 2,
        y: row * step - step / 2,
      });
      ctx.globalAlpha = 0.85;
      ctx.drawImage(mark, box.x, box.y, box.width, box.height);
    }
  }
  ctx.globalAlpha = 1;
};

/**
 * The mark at the resolution a stitch or a bulb gives it.
 *
 * Drawn small and blown back up with smoothing off, which is exactly what
 * embroidery, a receipt printer and an LED board each do in their own way.
 * Cheaper than three separate mockups and it fails in the same place they do.
 */
const drawDotMatrix: Draw = (ctx, mark) => {
  const coarse = 28;
  const small = document.createElement("canvas");
  small.width = coarse;
  small.height = coarse;
  const smallCtx = small.getContext("2d");
  if (!smallCtx) {
    return;
  }
  const box = fitted(mark, { height: coarse, width: coarse, x: 0, y: 0 });
  smallCtx.drawImage(mark, box.x, box.y, box.width, box.height);
  ctx.imageSmoothingEnabled = false;
  const out = inner();
  ctx.drawImage(small, out.x, out.y, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
};

/**
 * The mark pressed into the surface, lit at the size it is seen.
 *
 * The relief is computed at the box it will occupy, not at the artwork's own
 * resolution. Relighting a 1024-pixel master and then shrinking it averages
 * every bevel back out again — which is how this tile came out as a faint
 * wire tracing of the silhouette with the wordmark missing entirely.
 */
const drawEmboss: Draw = (ctx, mark) => {
  const box = fitted(mark, inner());
  const relief = reliefOf(mark, {
    height: Math.round(box.height),
    width: Math.round(box.width),
  });
  ground(ctx, "#8f8f8f", { height: TILE, width: TILE });
  ctx.drawImage(relief, box.x, box.y, box.width, box.height);
};

const drawAppIcon: Draw = (ctx, mark, tile) => {
  /*
   * A neutral surround, because an icon is a shape before it is a colour.
   *
   * The ground came from the kit's accent and so did the icon, so the two
   * matched exactly and the rounded square vanished: the tile was a field of
   * red with a wordmark floating in it, which tests nothing. What an app icon
   * has to survive is a home screen full of other icons — a corner radius, a
   * hard edge, and something behind it that is not itself.
   */
  ground(ctx, "#dedee2", { height: TILE, width: TILE });
  const side = TILE - PAD * 2;
  const radius = side * 0.22;
  ctx.beginPath();
  ctx.roundRect(PAD, PAD, side, side, radius);
  ctx.fillStyle = tile.background ?? "#101a2b";
  ctx.fill();
  ctx.save();
  ctx.clip();
  const box = fitted(mark, {
    height: side * 0.56,
    width: side * 0.56,
    x: PAD + side * 0.22,
    y: PAD + side * 0.22,
  });
  /*
   * The mark as it is, not knocked down to one ink.
   *
   * An app icon is the one place the artwork is met in full colour at a size
   * nobody can enlarge, so flattening it here would answer the question the
   * tile exists to ask. `inked` stands down on its own for multi-coloured
   * artwork now; the ink is still honoured for a mark that really is one.
   */
  ctx.drawImage(
    tile.ink ? inked(mark, tile.ink) : mark,
    box.x,
    box.y,
    box.width,
    box.height
  );
  ctx.restore();
};

const drawLockup: Draw = (ctx, mark, tile, { typeface }) => {
  const box = fitted(mark, {
    height: 96,
    width: 96,
    x: PAD,
    y: TILE / 2 - 48,
  });
  ctx.drawImage(mark, box.x, box.y, box.width, box.height);
  ctx.fillStyle = "#101a2b";
  ctx.font = `40px ${typeface}, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(tile.words ?? "", PAD + 120, TILE / 2);
};

/**
 * The mark on a photographed surface.
 *
 * The drawn rectangles this replaces were a stand-in and read like one. A
 * client sees a flat grey box as a diagram and a lit billboard as the thing
 * itself, and that difference decides whether the sheet is evidence or a
 * wireframe.
 *
 * The blend is what makes it a mockup rather than a sticker: multiplied, the
 * panel's own hotspot falls across the artwork as well as around it;
 * screened, a cap's seam and weave show through light ink instead of stopping
 * at its edge.
 */
const drawTemplate: Draw = (ctx, mark, tile, context) => {
  const template = TEMPLATES.find((entry) => entry.id === tile.templateId);
  const photo = template ? context.photos.get(template.id) : undefined;
  if (!(template && photo)) {
    return;
  }
  ground(ctx, "#ffffff", { height: TILE, width: TILE });

  /*
   * The crop, covered into the tile rather than fitted into it.
   *
   * Fitting letterboxed a portrait mockup on white and left the subject the
   * size of a stamp — the lanyard tile was mostly blank page. Covering fills
   * the frame and loses the edges, which is what the edges of a stock mockup
   * are for.
   */
  const crop = template.crop ?? { h: 1, w: 1, x: 0, y: 0 };
  const sw = crop.w * photo.width;
  const sh = crop.h * photo.height;
  const scale = Math.max(TILE / sw, TILE / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (TILE - dw) / 2;
  const dy = (TILE - dh) / 2;
  ctx.drawImage(
    photo,
    crop.x * photo.width,
    crop.y * photo.height,
    sw,
    sh,
    dx,
    dy,
    dw,
    dh
  );

  // The placement area is in fractions of the whole photograph, so it goes
  // through the same crop and scale the photograph did.
  const area = {
    height: template.area.h * photo.height * scale,
    width: template.area.w * photo.width * scale,
    x: dx + (template.area.x - crop.x) * photo.width * scale,
    y: dy + (template.area.y - crop.y) * photo.height * scale,
  };

  /*
   * A blank page first, when the mockup came with a design already on it.
   *
   * A bought book mockup is photographed with sample artwork printed on the
   * cover, and nothing removes it — so without this the sample shows around
   * whatever the mark does not cover and the tile is two designs arguing. The
   * plate covers it; the photograph's own light is multiplied back over the
   * top a moment later, so the page is blanked on the object rather than
   * stickered over it.
   */
  if (template.plate) {
    ctx.fillStyle = template.plate;
    ctx.fillRect(area.x, area.y, area.width, area.height);
  }

  const box = fitted(mark, area);
  ctx.save();
  /*
   * A plated surface is drawn on flat, not blended.
   *
   * Blending is how a mark picks up the light of the thing it is printed on,
   * and it only works when what is underneath is the surface. Under a plate
   * what is underneath is the plate, and under the plate is somebody else's
   * sample artwork — multiply there would print the mark through a cyan demo
   * cover. Losing the cover's gradient is the cost of not showing two designs
   * at once, and it is the cheaper of the two.
   */
  ctx.globalCompositeOperation = template.plate
    ? "source-over"
    : template.blend;
  ctx.globalAlpha = template.opacity ?? 1;
  ctx.drawImage(
    template.ink ? inked(mark, template.ink) : mark,
    box.x,
    box.y,
    box.width,
    box.height
  );
  ctx.restore();
};

/**
 * The mark, as it is, on whatever ground the tile asked for.
 *
 * Serves the tiles whose whole test is the ground or a filter — greyscale,
 * squint, on black, on a palette colour — and stands in for any kind the
 * table does not know. A tile added to the plan and forgotten here draws
 * something honest rather than a blank square or an exception that takes the
 * rest of the sheet with it.
 */
const drawPlainly: Draw = (ctx, mark, tile) => {
  const size = { height: TILE, width: TILE };
  if (tile.kind === "negative") {
    ground(ctx, tile.ink ?? "#101a2b", size);
  }
  if (tile.kind === "greyscale") {
    ctx.filter = "grayscale(1)";
  }
  if (tile.kind === "squint") {
    ctx.filter = `blur(${tile.blur ?? 6}px)`;
  }
  const box = fitted(mark, inner(), { enlarge: false });
  const drawn = tile.kind === "negative" ? inked(mark, "#ffffff") : mark;
  ctx.drawImage(drawn, box.x, box.y, box.width, box.height);
  ctx.filter = "none";
};

/**
 * Which function draws which kind.
 *
 * A table rather than a chain of branches: the chain was one `else if` per
 * tile and grew past the complexity ceiling the moment the sheet did. Every
 * kind absent from here falls to drawPlainly, which is right for the ones
 * whose test *is* the ground.
 */
const DRAWS: Partial<Record<ProofTile["kind"], Draw>> = {
  appicon: drawAppIcon,
  card: (ctx, mark, tile) =>
    drawCard(ctx, TILE, { mark, name: tile.words ?? "", tile }),
  dotmatrix: drawDotMatrix,
  emboss: drawEmboss,
  favicon: (ctx, mark, tile) =>
    drawFavicon(ctx, TILE, { mark, name: tile.words ?? "", tile }),
  lockup: drawLockup,
  onphoto: (ctx, mark, _tile, context) =>
    drawOnPhoto(ctx, TILE, mark, context.grounds),
  outline: (ctx, _mark, _tile, context) => drawBezier(ctx, TILE, context.paths),
  pattern: drawPattern,
  scale: drawScale,
  surface: drawTemplate,
};

export interface TileContext {
  /**
   * Photographs the mark is stood on, fetched from Unsplash before drawing.
   *
   * Empty when none could be had, which the tile says rather than hides — a
   * proof sheet that quietly drops a test is worse than one that is short.
   */
  grounds: { credit: string; image: CanvasImageSource; label: string }[];
  /** The declared floor, drawn as a line on the scale ramp. */
  minWidth: number;
  /** The mark's own curves, when it is vector artwork. Null when it is not. */
  paths: MarkPaths | null;
  /** The template photographs, loaded before any drawing starts. */
  photos: Map<string, Mark>;
  /** The kit's first typeface, for the lockup. */
  typeface: string;
}

/**
 * Draws one tile and hands back the canvas.
 *
 * A kind it does not know draws the mark plainly rather than throwing: a tile
 * added to the plan and not yet to the renderer should look unfinished, not
 * take the whole sheet down with it.
 */
export const drawTile = (
  mark: Mark,
  tile: ProofTile,
  context: TileContext
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.scale(SCALE, SCALE);
  const size = { height: TILE, width: TILE };
  ground(ctx, tile.background ?? "#f7f7f7", size);
  (DRAWS[tile.kind] ?? drawPlainly)(ctx, mark, tile, context);

  caption(
    ctx,
    tile.label,
    size,
    tile.background === "#000000" || tile.kind === "negative"
      ? "#9a9a9a"
      : "#8a8a8a"
  );
  return canvas;
};
