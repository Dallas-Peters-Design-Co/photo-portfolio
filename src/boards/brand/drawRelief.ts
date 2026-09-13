/**
 * The mark as a relief, lit rather than faked.
 *
 * The first version drew two offset copies in two greys, which is the trick a
 * word processor calls "emboss" and which anybody who has held a debossed card
 * can see is not one. It says nothing about the artwork: a shape with fine
 * interior detail and a shape without it come out identical, because the trick
 * only ever looks at the silhouette.
 *
 * A real relief is a lighting calculation. Luminance becomes height — light
 * parts of the mark stand proud, dark parts sink — and the surface is then lit
 * from one side. What you see is the *slope* at every point, so an edge inside
 * the mark catches light exactly as an edge in foil or a die would, and a flat
 * field stays flat. That is the difference between a picture of a relief and a
 * measurement of one.
 */

/** Rec. 709, the same weighting relativeLuminance uses for contrast. */
const LUMA = { b: 0.0722, g: 0.7152, r: 0.2126 };

/** Where the light comes from. Up and to the left, as every relief is lit. */
const LIGHT = { x: -1, y: -1 };

/**
 * How pronounced the relief is.
 *
 * High enough that a real edge reads, low enough that halftone grain does not
 * become a landscape of its own — a coarse print texture has slopes at every
 * pixel, and lighting them all turns the tile into noise.
 */
const DEPTH = 2.4;

/**
 * How far apart the two samples that make a slope are taken.
 *
 * The first version measured across one pixel, and one pixel is the wrong
 * width for the question. A letter stroke fifteen pixels wide has a slope only
 * in the pixel at each of its edges; everything between is flat, and everything
 * outside is flat, so the mark came back as a wire outline of itself with the
 * wordmark simply gone. A die does not work that way. Its bevel is a width,
 * and every part of the artwork narrower than that bevel is lit all the way
 * through.
 *
 * Scaled to the artwork so a mark relit at 480 pixels and the same mark at
 * 2000 get the same bevel in proportion, not the same bevel in pixels.
 */
const BEVEL = 110;

/** The mid grey a flat, unsloped area settles at. */
const FLAT = 148;

/**
 * Height at a point: how light the mark is there, and zero outside it.
 *
 * Alpha multiplies rather than gates, so a soft edge ramps down to the ground
 * instead of falling off a cliff — which is what a die does to a soft edge too.
 */
const heightAt = (
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number
): number => {
  const at = (y * width + x) * 4;
  const alpha = (data[at + 3] ?? 0) / 255;
  const luma =
    LUMA.r * (data[at] ?? 0) +
    LUMA.g * (data[at + 1] ?? 0) +
    LUMA.b * (data[at + 2] ?? 0);
  return (luma / 255) * alpha;
};

/**
 * The mark, relit as a surface.
 *
 * Returns a canvas of the same size, grey, with no transparency: a relief is
 * something the material does, so there is no "outside the mark" left once it
 * has been pressed.
 */
export const reliefOf = (
  mark: CanvasImageSource & { height: number; width: number },
  /**
   * The size to relight at, when it is not the artwork's own.
   *
   * Callers pass the size the tile will actually show, because a bevel is a
   * feature of what you are looking at. Relighting a 2000-pixel master and
   * then shrinking it to 480 averages every bevel away again, which is how the
   * relief came out looking like a faint pencil tracing.
   */
  shownAt?: { height: number; width: number }
): HTMLCanvasElement => {
  const width = Math.max(1, Math.round(shownAt?.width ?? mark.width));
  const height = Math.max(1, Math.round(shownAt?.height ?? mark.height));
  const step = Math.max(1, Math.round(Math.max(width, height) / BEVEL));
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const from = source.getContext("2d", { willReadFrequently: true });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const to = canvas.getContext("2d");
  if (!(from && to)) {
    return canvas;
  }
  from.drawImage(mark, 0, 0, width, height);
  const { data } = from.getImageData(0, 0, width, height);
  const lit = to.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // The slope, from the neighbours either side. Clamped at the edges so
      // the border does not light up as a cliff of its own.
      const left = heightAt(data, width, Math.max(0, x - step), y);
      const right = heightAt(data, width, Math.min(width - 1, x + step), y);
      const up = heightAt(data, width, x, Math.max(0, y - step));
      const down = heightAt(data, width, x, Math.min(height - 1, y + step));
      const slope = (right - left) * LIGHT.x + (down - up) * LIGHT.y;

      const shade = Math.max(0, Math.min(255, FLAT + slope * DEPTH * 255));
      const at = (y * width + x) * 4;
      lit.data[at] = shade;
      lit.data[at + 1] = shade;
      lit.data[at + 2] = shade;
      lit.data[at + 3] = 255;
    }
  }
  to.putImageData(lit, 0, 0);
  return canvas;
};
