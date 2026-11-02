import {
  adobeFontCss,
  googleFontCss,
  parseFontRef,
} from "../../../config/fontRef";
import { type ZipFile, zip } from "../../lib/zip";
import type { BoardItem } from "../../types";
import {
  type DrawingConfig,
  isDrawingConfig,
  isTransparent,
} from "../drawing/drawing";
import { type ShapeGeometry, shapeGeometry } from "../drawing/shapes";
import { currentImageUrl } from "../itemOutput";
import type { Box } from "./creativeModel";
import { imageRadius } from "./imageRadius";
import { rotationOf } from "./rotate";
import { effectRules, lookOf, scaled, type TextLook } from "./textLook";

/**
 * A frame's design as an HTML5 display ad: one index.html at the ad's real
 * pixel size, its pictures and self-hosted fonts beside it in the zip, and
 * the clickTag ad servers swap in for their tracking link.
 *
 * Each layer becomes one absolutely positioned element in stacking order, so
 * the page is the design and nothing else: no script but the clickTag, no
 * framework, nothing to load that the zip doesn't carry (Google and Adobe
 * fonts excepted, as stylesheet links).
 */

/** The size most networks cap an HTML5 upload at (Google Ads: 150 KB). */
export const AD_WEIGHT_LIMIT = 150 * 1024;

export const escapeHtml = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

const styleOf = (rules: Record<string, string | null | undefined>): string =>
  Object.entries(rules)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

/** A triangle, polygon, star, squircle or line (drawing/shapes.ts) as SVG. */
const pathShapeHtml = (
  shape: ShapeGeometry,
  config: DrawingConfig,
  place: Record<string, string | null>,
  stroke: number
): string => {
  const w = Number.parseFloat(place.width ?? "0");
  const h = Number.parseFloat(place.height ?? "0");
  const fill =
    shape.closed && config.fill && !isTransparent(config.fill)
      ? escapeHtml(config.fill)
      : "none";
  const line = stroke > 0 ? escapeHtml(config.stroke) : "none";
  const head = shape.head
    ? `<path d="${shape.head}" fill="${escapeHtml(config.stroke)}"/>`
    : "";
  return `<svg style="${styleOf({ ...place, overflow: "visible" })}" viewBox="0 0 ${w} ${h}"><path d="${shape.d}" fill="${fill}" stroke="${line}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>${head}</svg>`;
};

/** Where a layer sits inside the ad, in the ad's pixels. */
export const placeOf = (item: Box, frame: Box, scale: number) => ({
  height: px(item.height * scale),
  left: px((item.x - frame.x) * scale),
  position: "absolute",
  top: px((item.y - frame.y) * scale),
  width: px(item.width * scale),
});

export const shapeHtml = (
  config: DrawingConfig,
  place: Record<string, string>,
  scale: number
): string => {
  const opacity =
    typeof config.opacity === "number" && config.opacity < 1
      ? `${config.opacity}`
      : null;
  const stroke = Math.max(0, config.strokeWidth) * scale;
  const shape = shapeGeometry(
    config,
    Number.parseFloat(place.width),
    Number.parseFloat(place.height),
    stroke
  );
  if (shape) {
    return pathShapeHtml(shape, config, { ...place, opacity }, stroke);
  }
  if (config.points && config.points.length > 0) {
    // Freehand: unit-space points stretched across the box, as on the board.
    const points = config.points.map((p) => `${p.x},${p.y}`).join(" ");
    return `<svg style="${styleOf({ ...place, opacity, overflow: "visible" })}" viewBox="0 0 1 1" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="${escapeHtml(config.stroke)}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
  const fallback = config.tool === "rounded" ? 18 : 0;
  const radius =
    config.tool === "ellipse"
      ? "50%"
      : px(
          (typeof config.radius === "number" ? config.radius : fallback) * scale
        );
  const visibleStroke = stroke > 0 && !isTransparent(config.stroke);
  return `<div style="${styleOf({
    ...place,
    background: config.fill && !isTransparent(config.fill) ? config.fill : null,
    "border-radius": radius === "0px" ? null : radius,
    "box-shadow": visibleStroke
      ? `inset 0 0 0 ${px(stroke)} ${config.stroke}`
      : null,
    opacity,
  })}"></div>`;
};

/** The computed style a text layer was drawn with, at the ad's scale. */
export const textHtml = (
  body: string,
  look: TextLook,
  place: Record<string, string>,
  scale: number
): string =>
  `<div style="${escapeHtml(
    styleOf({
      ...place,
      color: look.color,
      "font-family": look.fontFamily,
      "font-kerning": look.fontKerning === "none" ? "none" : null,
      "font-size": scaled(look.fontSize, scale),
      "font-style": look.fontStyle === "normal" ? null : look.fontStyle,
      "font-weight": look.fontWeight,
      "letter-spacing":
        look.letterSpacing === "normal"
          ? null
          : scaled(look.letterSpacing, scale),
      "line-height":
        look.lineHeight === "normal" ? null : scaled(look.lineHeight, scale),
      padding: `${scaled(look.paddingTop, scale) ?? "0"} ${scaled(look.paddingLeft, scale) ?? "0"} ${scaled(look.paddingBottom ?? look.paddingTop, scale) ?? "0"}`,
      "text-align": look.textAlign === "start" ? null : look.textAlign,
      "text-transform":
        look.textTransform === "none" ? null : look.textTransform,
      "white-space": "pre-wrap",
      ...effectRules(look, scale),
    })
  )}">${escapeHtml(body)}</div>`;

export const imageHtml = (
  src: string,
  place: Record<string, string>,
  radius = 0
): string =>
  `<img alt="" src="${escapeHtml(src)}" style="${styleOf({ ...place, "border-radius": radius > 0 ? px(radius) : null, "object-fit": "cover" })}">`;

export interface AdPage {
  body: string[];
  clickUrl: string;
  fontCss: string;
  fontLinks: string[];
  height: number;
  /** An ad (fixed size, clickTag) or a web page (fits the window). */
  mode: "ad" | "page";
  title: string;
  width: number;
}

const json = (value: string) =>
  JSON.stringify(value).replaceAll("<", "\\u003c");

/** The ad's head-specific lines: its size and the ad server's clickTag. */
const adHead = (page: AdPage) =>
  page.mode === "ad"
    ? `<meta name="ad.size" content="width=${page.width},height=${page.height}">
<script>var clickTag = ${json(page.clickUrl)};</script>`
    : `<meta name="viewport" content="width=device-width,initial-scale=1">`;

const clickLayer = (page: AdPage) => {
  if (page.mode === "ad") {
    return `<a id="click" href="javascript:window.open(window.clickTag)" aria-label="${escapeHtml(page.title)}"></a>`;
  }
  return page.clickUrl
    ? `<a id="click" href="${escapeHtml(page.clickUrl)}" aria-label="${escapeHtml(page.title)}"></a>`
    : "";
};

/** A page scales the design down to narrow windows, never up. */
const fitScript = (page: AdPage) =>
  page.mode === "page"
    ? `<script>(function(){var a=document.getElementById("ad");function fit(){var s=Math.min(1,document.documentElement.clientWidth/${page.width});a.style.transform="scale("+s+")";document.body.style.height=${page.height}*s+"px"}addEventListener("resize",fit);fit()})();</script>`
    : "";

export const adHtml = (page: AdPage): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${adHead(page)}
<title>${escapeHtml(page.title)}</title>
${page.fontLinks.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`).join("\n")}
<style>
${page.fontCss}
html,body{margin:0;padding:0${page.mode === "page" ? ";overflow-x:hidden" : ""}}
#ad{position:relative;width:${page.width}px;height:${page.height}px;overflow:hidden;background:#fff;-webkit-font-smoothing:antialiased${page.mode === "page" ? ";margin:0 auto;transform-origin:0 0" : ""}}
#ad *{box-sizing:border-box;margin:0}
#click{position:absolute;inset:0;z-index:1;display:block}
</style>
</head>
<body>
<div id="ad">
${page.body.join("\n")}
${clickLayer(page)}
</div>
${fitScript(page)}
</body>
</html>
`;

/** Google and Adobe stylesheets for the brand fonts the text layers use. */
export const fontLinksFor = (layers: BoardItem[]): string[] => {
  const links = new Set<string>();
  for (const item of layers) {
    const ref = parseFontRef(item.textStyle?.family);
    if (ref?.source === "google") {
      links.add(googleFontCss(ref.family));
    } else if (ref?.kitId) {
      links.add(adobeFontCss(ref.kitId));
    }
  }
  return [...links];
};

const EXT: Record<string, string> = {
  "font/otf": "otf",
  "font/ttf": "ttf",
  "font/woff": "woff",
  "font/woff2": "woff2",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

const fetchBytes = async (
  url: string
): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string } | null> => {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) {
      return null;
    }
    const type = (res.headers.get("content-type") ?? "").split(";")[0] ?? "";
    return { bytes: new Uint8Array(await res.arrayBuffer()), type };
  } catch {
    return null;
  }
};

const extOf = (url: string, type: string, fallback: string) =>
  EXT[type] ??
  new URL(url, location.href).pathname.split(".").pop()?.toLowerCase() ??
  fallback;

const FONT_URL = /url\((["']?)([^"')]+)\1\)/g;

/**
 * Our own @font-face rules for the families in use, with their files copied
 * into the zip. Google and Adobe sheets are cross-origin and can't be read,
 * which is why those go in as links instead.
 */
const familyOf = (rule: CSSFontFaceRule) =>
  rule.style.getPropertyValue("font-family").replaceAll(/["']/g, "").trim();

/** Our own @font-face rules for these families, from the readable sheets. */
const fontFaceRules = (families: Set<string>): string[] =>
  [...document.styleSheets].flatMap((sheet) => {
    try {
      return [...sheet.cssRules]
        .filter(
          (rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule
        )
        .filter((rule) => families.has(familyOf(rule)))
        .map((rule) => rule.cssText);
    } catch {
      // Cross-origin sheets (Google, Adobe) can't be read; they go in as links.
      return [];
    }
  });

/**
 * Self-hosted fonts in use, their files copied into the zip and the rules
 * pointed at the copies.
 */
const selfHostedFonts = async (
  families: Set<string>,
  files: ZipFile[]
): Promise<string> => {
  const rules = fontFaceRules(families);
  const urls = [
    ...new Set(
      rules.flatMap((css) =>
        [...css.matchAll(FONT_URL)]
          .map(([, , url]) => url ?? "")
          .filter((url) => url && !url.startsWith("data:"))
      )
    ),
  ];
  const copies = await Promise.all(
    urls.map(async (url, i) => {
      const absolute = new URL(url, location.href).href;
      const got = await fetchBytes(absolute);
      if (!got) {
        return null;
      }
      const name = `fonts/font-${i + 1}.${extOf(absolute, got.type, "woff2")}`;
      files.push({ bytes: got.bytes, name });
      return [url, name] as const;
    })
  );
  const renamed = new Map(copies.filter((c) => c !== null));
  return rules
    .map((css) =>
      css.replaceAll(FONT_URL, (whole, _q, url: string) => {
        const name = renamed.get(url);
        return name ? `url("${name}")` : whole;
      })
    )
    .join("\n");
};

/** Every picture the layers use, copied in where the host allows it. */
const copyImages = async (
  layers: BoardItem[],
  files: ZipFile[]
): Promise<Map<string, string>> => {
  const urls = [
    ...new Set(
      layers
        .filter(
          (l) => l.kind !== "drawing" && l.kind !== "text" && l.kind !== "note"
        )
        .map((l) => currentImageUrl(l))
        .filter((url): url is string => Boolean(url))
    ),
  ];
  const got = await Promise.all(urls.map((url) => fetchBytes(url)));
  return new Map(
    urls.map((url, i) => {
      const copy = got[i];
      if (!copy) {
        return [url, url];
      }
      const name = `images/image-${i + 1}.${extOf(url, copy.type, "jpg")}`;
      files.push({ bytes: copy.bytes, name });
      return [url, name];
    })
  );
};

const firstFamily = (stack: string) =>
  stack.split(",")[0]?.replaceAll(/["']/g, "").trim() ?? "";

export interface Html5Export {
  blob: Blob;
  /** Pictures that couldn't be copied in and stay linked to their address. */
  linked: number;
}

const layerHtml = (
  item: BoardItem,
  place: Record<string, string>,
  scale: number,
  images: Map<string, string>,
  text: (id: string) => TextLook | null
): string | null => {
  if (item.kind === "drawing" && isDrawingConfig(item.config)) {
    return shapeHtml(item.config, place, scale);
  }
  if (item.kind === "text" || item.kind === "note") {
    const look = text(item.id);
    return look ? textHtml(item.body ?? "", look, place, scale) : null;
  }
  const src = images.get(currentImageUrl(item) ?? "");
  return src ? imageHtml(src, place, imageRadius(item) * scale) : null;
};

export const exportHtml5 = async (
  frame: Box & { body?: string | null },
  layers: BoardItem[],
  pxWidth: number,
  textElementFor: (id: string) => HTMLElement | null,
  clickUrl: string,
  mode: AdPage["mode"] = "ad"
): Promise<Html5Export> => {
  const scale = pxWidth / frame.width;
  const files: ZipFile[] = [];
  const looks = new Map<string, TextLook>();
  for (const item of layers) {
    const el = textElementFor(item.id);
    if (el && (item.kind === "text" || item.kind === "note")) {
      looks.set(item.id, lookOf(el));
    }
  }
  const families = new Set(
    [...looks.values()].map((look) => firstFamily(look.fontFamily))
  );
  const [images, fontCss] = await Promise.all([
    copyImages(layers, files),
    selfHostedFonts(families, files),
  ]);
  const body = layers
    .map((item) =>
      layerHtml(
        item,
        rotationOf(item)
          ? {
              ...placeOf(item, frame, scale),
              transform: `rotate(${rotationOf(item)}deg)`,
            }
          : placeOf(item, frame, scale),
        scale,
        images,
        (id) => looks.get(id) ?? null
      )
    )
    .filter((markup): markup is string => markup !== null);

  const html = adHtml({
    body,
    clickUrl,
    fontCss,
    fontLinks: fontLinksFor(layers),
    height: Math.round(frame.height * scale),
    mode,
    title: frame.body?.trim() || "Ad",
    width: Math.round(frame.width * scale),
  });
  // index.html first, as ad servers expect, then the assets in a fixed order.
  files.sort((one, two) => one.name.localeCompare(two.name));
  files.unshift({ bytes: new TextEncoder().encode(html), name: "index.html" });
  const linked = [...images].filter(([url, src]) => url === src).length;
  return { blob: zip(files), linked };
};
