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
  /**
   * How many separate books the template shows, when more than one. Then
   * books.png says which book each pixel belongs to (1..n, 0 for none), and
   * the render takes a cover per book.
   */
  books?: number;
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
export const MOCKUP_TEMPLATES: readonly Omit<
  MockupTemplate,
  "coverAspect" | "crop" | "height" | "spine" | "width"
>[] = [
  { base: "/mockups/book-front", id: "book-front", label: "Face up" },
  { base: "/mockups/book-tilt", id: "book-tilt", label: "Tilted" },
  { base: "/mockups/book-stack", id: "book-stack", label: "Stacked" },
  { base: "/mockups/book-open", id: "book-open", label: "Open and closed" },
  {
    base: "/mockups/book-soft-02",
    id: "book-soft-02",
    label: "Softcover, front and back",
  },
  {
    base: "/mockups/book-soft-04",
    id: "book-soft-04",
    label: "Softcover, front over back",
  },
  {
    base: "/mockups/book-soft-05",
    id: "book-soft-05",
    label: "Softcover, three in a row",
  },
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
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const channel = (at: number) => Number.parseInt(full.slice(at, at + 2), 16);
  const rgb: [number, number, number] = [channel(0), channel(2), channel(4)];
  return full.length === 6 && rgb.every(Number.isFinite) ? rgb : [41, 51, 65];
};

/** Loaded once per template per session; the files never change. */
const loaded = new Map<string, Promise<LoadedTemplate>>();

interface LoadedTemplate {
  a: ImageData;
  b: ImageData;
  /** Which book each pixel belongs to, for a template of several. */
  books: ImageData | null;
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
    const several = (manifest.books ?? 1) > 1;
    const [a, b, uv, s, k, uvb, books] = await Promise.all([
      loadPicture(`${base}/a.jpg`),
      loadPicture(`${base}/b.jpg`),
      loadPicture(`${base}/uv.png`),
      manifest.spine ? loadPicture(`${base}/s.jpg`) : Promise.resolve(null),
      manifest.back ? loadPicture(`${base}/k.jpg`) : Promise.resolve(null),
      manifest.back ? loadPicture(`${base}/uvb.png`) : Promise.resolve(null),
      several ? loadPicture(`${base}/books.png`) : Promise.resolve(null),
    ]);
    return {
      a: pixelsOf(a, width, height),
      b: pixelsOf(b, width, height),
      books: books ? pixelsOf(books, width, height) : null,
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
 * How far a cover's proportions may be from the template's before it is
 * shown whole rather than stretched. A 6 × 9 cover on a book the mockup's
 * author drew at 0.70 is a 6% stretch, invisible in a photograph; a square
 * cover on the same book is not, and gets the whole picture with the edge
 * colour either side.
 */
const STRETCH_TOLERANCE = 0.08;

/**
 * The cover, fitted to the template's expected proportions.
 *
 * A template was warped for the book its author drew, which is rarely the
 * exact trim of the cover it is handed. Cropping cut the title off a 6 × 9
 * cover on a 0.70 book, so a near miss is stretched to fit — nothing lost —
 * and a far one is shown whole on the cover's own edge colour. Sampled at
 * twice the largest the cover will appear, so bilinear lookup below has
 * something to average.
 */
const fitCover = (
  cover: HTMLImageElement,
  aspect: number,
  size: number,
  /** Which part of the picture to use, as fractions; the whole by default. */
  window: [number, number, number, number] = [0, 0, 1, 1],
  /** What shows beside a cover too far from the template's proportions. */
  fill = "#293341"
): ImageData => {
  const w = size;
  const h = Math.round(size / aspect);
  const sx = window[0] * cover.naturalWidth;
  const sy = window[1] * cover.naturalHeight;
  const sw = (window[2] - window[0]) * cover.naturalWidth;
  const sh = (window[3] - window[1]) * cover.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("This browser cannot read pixels back.");
  }
  const own = sw / sh;
  if (Math.abs(own - aspect) / aspect <= STRETCH_TOLERANCE) {
    ctx.drawImage(cover, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
    const scale = Math.min(w / sw, h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(cover, sx, sy, sw, sh, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
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
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
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
  out[1] =
    S[i00 + 1] * w00 + S[i10 + 1] * w10 + S[i01 + 1] * w01 + S[i11 + 1] * w11;
  out[2] =
    S[i00 + 2] * w00 + S[i10 + 2] * w10 + S[i01 + 2] * w01 + S[i11 + 2] * w11;
};

/** u and v out of the UV map's pixel at byte offset p, or null when outside. */
const uvAt = (U: Uint8ClampedArray, p: number): [number, number] | null => {
  const r = U[p];
  const g = U[p + 1];
  const b = U[p + 2];
  if (r === 0 && g === 0 && b === 0) {
    return null;
  }
  // Twelve bits an axis: the high eight in R (or G), the low four shared in B.
  return [(r * 16 + Math.floor(b / 16)) / 4095, (g * 16 + (b % 16)) / 4095];
};

/** The three channels of one pixel, as a scratch value passed around. */
type Rgb = [number, number, number];

/** What one render needs per pixel, gathered once so the loop stays flat. */
interface Shading {
  /** The photograph with the covers black. */
  a: Uint8ClampedArray;
  /** How much of the cover's colour reaches each pixel. */
  b: Uint8ClampedArray;
  /** The back cover's shading and map, where the template shows one. */
  back: {
    k: Uint8ClampedArray;
    uvb: Uint8ClampedArray;
    src: ImageData | null;
  } | null;
  /** Which book each pixel belongs to, for a template of several. */
  books: Uint8ClampedArray | null;
  /** The covers, in book order. */
  covers: ImageData[];
  /** The spine strip's shading, where the template has one. */
  spine: Uint8ClampedArray | null;
  spineColour: Rgb;
  uv: Uint8ClampedArray;
}

/** Adds `shade · colour / 255` for one pixel into `into`. */
const addLit = (
  into: Rgb,
  lit: Uint8ClampedArray,
  p: number,
  colour: Rgb
): void => {
  into[0] += (lit[p] * colour[0]) / 255;
  into[1] += (lit[p + 1] * colour[1]) / 255;
  into[2] += (lit[p + 2] * colour[2]) / 255;
};

/** The cover's contribution to pixel p, if the pixel is on a cover. */
const addCover = (into: Rgb, s: Shading, p: number, px: Rgb): void => {
  const uv = uvAt(s.uv, p);
  if (!uv) {
    return;
  }
  const which = s.books ? s.books[p] : 0;
  const cover =
    which > 1 ? s.covers[(which - 1) % s.covers.length] : s.covers[0];
  sample(cover, uv[0], uv[1], px);
  addLit(into, s.b, p, px);
};

/** The back cover's contribution: the wrap's back panel, or the spine colour. */
const addBack = (into: Rgb, s: Shading, p: number, px: Rgb): void => {
  if (!s.back) {
    return;
  }
  const uvb = uvAt(s.back.uvb, p);
  if (!uvb) {
    return;
  }
  if (s.back.src) {
    sample(s.back.src, uvb[0], uvb[1], px);
    addLit(into, s.back.k, p, px);
  } else {
    addLit(into, s.back.k, p, s.spineColour);
  }
};

/** Every pixel of the template, shaded, as the full-size picture. */
const shade = (s: Shading, width: number, height: number): ImageData => {
  const out = new ImageData(width, height);
  const O = out.data;
  const px: Rgb = [0, 0, 0];
  const into: Rgb = [0, 0, 0];
  for (let p = 0; p < O.length; p += 4) {
    into[0] = s.a[p];
    into[1] = s.a[p + 1];
    into[2] = s.a[p + 2];
    if (s.spine) {
      addLit(into, s.spine, p, s.spineColour);
    }
    addCover(into, s, p, px);
    addBack(into, s, p, px);
    O[p] = Math.min(255, into[0]);
    O[p + 1] = Math.min(255, into[1]);
    O[p + 2] = Math.min(255, into[2]);
    O[p + 3] = 255;
  }
  return out;
};

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
  /**
   * The cover — or, for a template of several books, the covers in book
   * order, left to right. Fewer covers than books wraps around, so one
   * cover on a three-book template is that cover three times.
   */
  cover: HTMLImageElement | HTMLImageElement[],
  options: {
    /** The print wrap, for templates that show the back. */
    back?: {
      image: HTMLImageElement;
      window: [number, number, number, number];
    } | null;
    outputWidth?: number;
    spine: string;
  }
): Promise<HTMLCanvasElement> => {
  const t = await loadTemplate(base);
  const { width, height, coverAspect, crop } = t.manifest;

  const covers = Array.isArray(cover) ? cover : [cover];
  if (covers.length === 0) {
    throw new Error("A mockup needs a cover.");
  }
  const srcs = covers.map((c) =>
    fitCover(c, coverAspect, 2048, undefined, options.spine)
  );
  const backSrc =
    t.k && options.back
      ? fitCover(
          options.back.image,
          coverAspect,
          2048,
          options.back.window,
          options.spine
        )
      : null;
  const out = shade(
    {
      a: t.a.data,
      b: t.b.data,
      back:
        t.k && t.uvb ? { k: t.k.data, src: backSrc, uvb: t.uvb.data } : null,
      books: t.books?.data ?? null,
      covers: srcs,
      spine: t.s?.data ?? null,
      spineColour: hexToRgb(options.spine),
      uv: t.uv.data,
    },
    width,
    height
  );

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
