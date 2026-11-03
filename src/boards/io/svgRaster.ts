import { useEffect, useState } from "react";

/**
 * SVG pictures drawn on the canvas as bitmaps.
 *
 * A browser re-draws an SVG image from its vector source every time its
 * on-screen size changes, which on a board is every frame of a zoom. A Studio
 * mosaic is thousands of tiles (one poster's is 11,000), and a board of
 * posters holds twenty of them, so zooming re-drew a couple of hundred
 * thousand shapes a frame. Measured on the 2027 posters board: 1 frame in 3
 * took over 50ms while zooming, and none did once each SVG was shown as a
 * bitmap of itself.
 *
 * So the canvas draws each SVG once, at the width the item asks for (the same
 * rungs photographs use, at most 2048px), and shows that. The SVG itself is
 * untouched: the frame editor, Present, print and export all still use it.
 * Pictures are drawn one at a time so a board opening doesn't freeze while
 * twenty of them render at once.
 */

const SVG_DATA = /^data:image\/svg/i;
const SVG_FILE = /\.svg(?:[?#]|$)/i;

export const isSvgUrl = (url: string): boolean =>
  SVG_DATA.test(url) || SVG_FILE.test(url);

const done = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();

const drawOrNull = async (
  url: string,
  width: number
): Promise<string | null> => {
  try {
    return await draw(url, width);
  } catch {
    return null;
  }
};

const draw = async (url: string, width: number): Promise<string | null> => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = url;
  await img.decode();
  if (!(img.naturalWidth > 0 && img.naturalHeight > 0)) {
    return null;
  }
  const w = Math.min(width, 2048);
  const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  return blob ? URL.createObjectURL(blob) : null;
};

/**
 * A bitmap of the SVG at this width, or null when it can't be made (no size
 * of its own, or a host that won't share its pixels); the caller then shows
 * the SVG as before.
 */
export const rasterOf = (
  url: string,
  width: number
): Promise<string | null> => {
  const key = `${width}|${url}`;
  let made = done.get(key);
  if (!made) {
    made = queue.then(() => drawOrNull(url, width));
    queue = made;
    done.set(key, made);
  }
  return made;
};

/**
 * What to put in an `<img>` for this picture at this width: the bitmap for an
 * SVG once it's ready (nothing until then, rather than the costly vector),
 * the SVG itself if a bitmap can't be made, and anything else unchanged.
 */
export const useCanvasSrc = (url: string, width: number): string | null => {
  const svg = isSvgUrl(url);
  const [made, setMade] = useState<string | null>(null);
  useEffect(() => {
    if (!svg) {
      return;
    }
    let alive = true;
    void rasterOf(url, width).then((src) => {
      if (alive) {
        setMade(src ?? url);
      }
    });
    return () => {
      alive = false;
    };
  }, [svg, url, width]);
  if (!svg) {
    return url;
  }
  // Keep showing the last bitmap while a sharper one is made.
  return made;
};
