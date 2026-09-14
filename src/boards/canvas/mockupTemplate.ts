/**
 * Drawing a cover into a baked mockup template.
 *
 * A template is three pictures and a few numbers, made once from a bought
 * Photoshop mockup by scripts/bake-mockup.py: `a` is the photograph with the
 * cover painted black, `b` is how much of the cover's colour reaches each
 * pixel, and `uv` says which point of the cover lands where — the Smart
 * Object's perspective and its warp mesh, resolved to 12 bits. The finished picture is
 * then, per pixel,
 *
 *     out = a + b · cover(uv)  (+ s · spineColour, + k · back(uvb), where shown)
 *
 * which is one texture lookup and a multiply-add. All the shading the
 * mockup's author painted — the page curl, the sheen, the shadow across the
 * cover — is inside `a` and `b`, so the result is the Photoshop render, not
 * an imitation of it. The old approach here drew a box with a shader and
 * looked like a box with a shader.
 *
 * Canvas2D rather than WebGL, because the UV lookup is a per-pixel loop over
 * ImageData and at 2250×1500 that is a few tens of milliseconds — not worth a
 * GPU context, a shader and the capture rules that come with one.
 */

export interface MockupTemplateManifest {
  /** True when the template shows a back cover too (k.jpg + uvb.png). */
  back?: boolean;
  coverAspect: number;
  /** The window worth showing, in template pixels. */
  crop: { height: number; width: number; x: number; y: number };
  height: number;
  id: string;
  label: string;
  /** True when the template has a spine strip that takes a colour. */
  spine: boolean;
  width: number;
}

export interface MockupTemplate extends MockupTemplateManifest {
  /** Where its files live, e.g. "/mockups/book-front". */
  base: string;
}

/** Every baked template. Add one by baking it and listing it here. */
export const MOCKUP_TEMPLATES: readonly Omit<MockupTemplate, "coverAspect" | "crop" | "height" | "spine" | "width">[] = [
  { base: "/mockups/book-front", id: "book-front", label: "Face up" },
  { base: "/mockups/book-tilt", id: "book-tilt", label: "Tilted" },
  { base: "/mockups/book-stack", id: "book-stack", label: "Stacked" },
  { base: "/mockups/book-open", id: "book-open", label: "Open and closed" },
  { base: "/mockups/book-soft-02", id: "book-soft-02", label: "Softcover, from above" },
  { base: "/mockups/book-soft-04", id: "book-soft-04", label: "Softcover, standing" },
  { base: "/mockups/book-soft-05", id: "book-soft-05", label: "Softcover, in a row" },
];

export const isMockupTemplateId = (value: unknown): boolean =>
  MOCKUP_TEMPLATES.some((t) => t.id === value);

const loadPicture = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });

const pixelsOf = (
  image: CanvasImageSource & { width: number; height: number },
  width: number,
  height: number
): ImageData => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("This browser cannot read pixels back.");
  }
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const raw = hex.trim().replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full, 16);
  return Number.isFinite(n) && full.length === 6
    ? [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    : [41, 51, 65];
};

/** Loaded once per template per session; the files never change. */
const loaded = new Map<string, Promise<LoadedTemplate>>();

interface LoadedTemplate {
  a: ImageData;
  b: ImageData;
  /** Shading for the back cover, where the template shows one. */
  k: ImageData | null;
  manifest: MockupTemplateManifest;
  s: ImageData | null;
  uv: ImageData;
  uvb: ImageData | null;
}

export const loadTemplate = (base: string): Promise<LoadedTemplate> => {
  const already = loaded.get(base);
  if (already) {
    return already;
  }
  const loading = (async () => {
    const res = await fetch(`${base}/template.json`);
    if (!res.ok) {
      throw new Error(`Mockup template missing: ${base}`);
    }
    const manifest = (await res.json()) as MockupTemplateManifest;
    const { width, height } = manifest;
    const [a, b, uv, s, k, uvb] = await Promise.all([
      loadPicture(`${base}/a.jpg`),
      loadPicture(`${base}/b.jpg`),
      loadPicture(`${base}/uv.png`),
      manifest.spine ? loadPicture(`${base}/s.jpg`) : Promise.resolve(null),
      manifest.back ? loadPicture(`${base}/k.jpg`) : Promise.resolve(null),
      manifest.back ? loadPicture(`${base}/uvb.png`) : Promise.resolve(null),
    ]);
    return {
      a: pixelsOf(a, width, height),
      b: pixelsOf(b, width, height),
      k: k ? pixelsOf(k, width, height) : null,
      manifest,
      s: s ? pixelsOf(s, width, height) : null,
      uv: pixelsOf(uv, width, height),
      uvb: uvb ? pixelsOf(uvb, width, height) : null,
    };
  })();
  loaded.set(base, loading);
  loading.catch(() => loaded.delete(base));
  return loading;
};

/**
 * The cover, fitted to the template's expected proportions.
 *
 * A template was warped for a 2:3 book. A cover that is not 2:3 is
 * centre-cropped to it rather than stretched, which is what a printer would
 * do with it too. Sampled at twice the largest the cover will appear, so
 * bilinear lookup below has something to average.
 */
const fitCover = (
  cover: HTMLImageElement,
  aspect: number,
  size: number,
  /** Which part of the picture to use, as fractions; the whole by default. */
  window: [number, number, number, number] = [0, 0, 1, 1]
): ImageData => {
  const w = size;
  const h = Math.round(size / aspect);
  const sx = window[0] * cover.naturalWidth;
  const sy = window[1] * cover.naturalHeight;
  const sw = (window[2] - window[0]) * cover.naturalWidth;
  const sh = (window[3] - window[1]) * cover.naturalHeight;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("This browser cannot read pixels back.");
  }
  ctx.drawImage(cover, sx, sy, sw, sh, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return ctx.getImageData(0, 0, w, h);
};

/**
 * Where the back panel sits in a KDP wrap, as fractions of the picture.
 *
 * Worked out from the wrap's proportions and the trim: the sheet is
 * 2 × trim + spine + 2 × bleed wide and trim + 2 × bleed tall, the height is
 * known, so the spine is what is left over and the back is the first trim
 * width after the bleed.
 */
export const wrapBackWindow = (
  wrapAspect: number,
  trimWidthIn: number,
  trimHeightIn: number
): [number, number, number, number] => {
  const bleed = 0.125;
  const totalH = trimHeightIn + bleed * 2;
  const totalW = wrapAspect * totalH;
  return [
    bleed / totalW,
    bleed / totalH,
    (bleed + trimWidthIn) / totalW,
    (bleed + trimHeightIn) / totalH,
  ];
};

/** One bilinear sample from an ImageData at (u, v) in 0..1. */
const sample = (
  img: ImageData,
  u: number,
  v: number,
  out: [number, number, number]
): void => {
  const sw = img.width;
  const sh = img.height;
  const S = img.data;
  const x = u * (sw - 1);
  const y = v * (sh - 1);
  const x0 = x | 0;
  const y0 = y | 0;
  const x1 = x0 + 1 < sw ? x0 + 1 : x0;
  const y1 = y0 + 1 < sh ? y0 + 1 : y0;
  const fx = x - x0;
  const fy = y - y0;
  const i00 = (y0 * sw + x0) * 4;
  const i10 = (y0 * sw + x1) * 4;
  const i01 = (y1 * sw + x0) * 4;
  const i11 = (y1 * sw + x1) * 4;
  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;
  out[0] = S[i00] * w00 + S[i10] * w10 + S[i01] * w01 + S[i11] * w11;
  out[1] = S[i00 + 1] * w00 + S[i10 + 1] * w10 + S[i01 + 1] * w01 + S[i11 + 1] * w11;
  out[2] = S[i00 + 2] * w00 + S[i10 + 2] * w10 + S[i01 + 2] * w01 + S[i11 + 2] * w11;
};

/** u and v out of the UV map's pixel at byte offset p, or null when outside. */
const uvAt = (U: Uint8ClampedArray, p: number): [number, number] | null =>
  U[p] | U[p + 1] | U[p + 2]
    ? [((U[p] << 4) | (U[p + 2] >> 4)) / 4095, ((U[p + 1] << 4) | (U[p + 2] & 15)) / 4095]
    : null;

/**
 * Renders the cover into the template and returns the cropped window.
 *
 * Bilinear on the cover, because the UV map has sub-pixel precision and a
 * nearest lookup would show the cover's pixel grid as moiré across the warp.
 * Where the template shows a back cover, it takes the wrap's back panel when
 * a wrap is given and the spine colour otherwise.
 */
export const renderTemplate = async (
  base: string,
  cover: HTMLImageElement,
  options: {
    /** The print wrap, for templates that show the back. */
    back?: { image: HTMLImageElement; window: [number, number, number, number] } | null;
    outputWidth?: number;
    spine: string;
  }
): Promise<HTMLCanvasElement> => {
  const t = await loadTemplate(base);
  const { width, height, coverAspect, crop } = t.manifest;

  const src = fitCover(cover, coverAspect, 2048);
  const backSrc =
    t.k && options.back
      ? fitCover(options.back.image, coverAspect, 2048, options.back.window)
      : null;

  const A = t.a.data;
  const B = t.b.data;
  const U = t.uv.data;
  const K = t.k?.data ?? null;
  const UB = t.uvb?.data ?? null;
  const Sp = t.s?.data ?? null;
  const [sr, sg, sb] = hexToRgb(options.spine);
  const px: [number, number, number] = [0, 0, 0];

  const out = new ImageData(width, height);
  const O = out.data;

  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    let r = A[p];
    let g = A[p + 1];
    let bl = A[p + 2];
    if (Sp) {
      r += (Sp[p] * sr) / 255;
      g += (Sp[p + 1] * sg) / 255;
      bl += (Sp[p + 2] * sb) / 255;
    }
    const uv = uvAt(U, p);
    if (uv) {
      sample(src, uv[0], uv[1], px);
      r += (B[p] * px[0]) / 255;
      g += (B[p + 1] * px[1]) / 255;
      bl += (B[p + 2] * px[2]) / 255;
    }
    if (K && UB) {
      const uvb = uvAt(UB, p);
      if (uvb) {
        if (backSrc) {
          sample(backSrc, uvb[0], uvb[1], px);
        } else {
          px[0] = sr;
          px[1] = sg;
          px[2] = sb;
        }
        r += (K[p] * px[0]) / 255;
        g += (K[p + 1] * px[1]) / 255;
        bl += (K[p + 2] * px[2]) / 255;
      }
    }
    O[p] = r > 255 ? 255 : r;
    O[p + 1] = g > 255 ? 255 : g;
    O[p + 2] = bl > 255 ? 255 : bl;
    O[p + 3] = 255;
  }

  const full = document.createElement("canvas");
  full.width = width;
  full.height = height;
  full.getContext("2d")?.putImageData(out, 0, 0);

  // Never upscaled: the window is cut at the template's own resolution, or
  // smaller when asked, so nothing soft is invented between real pixels.
  const outputWidth = Math.min(options.outputWidth ?? crop.width, crop.width);
  const outputHeight = Math.round((outputWidth * crop.height) / crop.width);
  const cropped = document.createElement("canvas");
  cropped.width = outputWidth;
  cropped.height = outputHeight;
  const ctx = cropped.getContext("2d");
  if (!ctx) {
    throw new Error("This browser cannot draw the mockup.");
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    full,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );
  return cropped;
};
