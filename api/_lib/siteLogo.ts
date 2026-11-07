import {
  persistBytes,
  persistSvgText,
  sniffImage,
} from "./persistGenerated.js";
import { fetchPublic } from "./sitePage.js";

/**
 * A brand's logo, taken from its website by the admin's scan
 * (scripts/scanBrand.mjs) and kept as our own file, like an uploaded one.
 *
 * Two kinds: an <img> the site serves, fetched here from a public address
 * only (the browser can't fetch it across origins), and an inline <svg> the
 * scan copied out of the page. Either way an SVG is cleaned before it's
 * stored, since it ends up on our own domain.
 */

const MAX_LOGO_BYTES = 3_000_000;
const MAX_SVG = 400_000;
const PREFIX = "brand-kits/logos";

const BLOCKS = /<(script|foreignObject|style|iframe)\b[\s\S]*?<\/\1\s*>/gi;
const SELF_CLOSED = /<(script|foreignObject|style|iframe)\b[^>]*\/>/gi;
const ON_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const HREF_ATTR = /\s+(?:xlink:)?href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const SVG_OPEN =
  /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype[^>]*>\s*)?<svg[\s>]/i;

/** An SVG with nothing that runs and no links off the file; null if it isn't one. */
export const cleanSvg = (raw: string): string | null => {
  if (raw.length > MAX_SVG || !SVG_OPEN.test(raw)) {
    return null;
  }
  return raw
    .replace(BLOCKS, "")
    .replace(SELF_CLOSED, "")
    .replace(ON_ATTR, "")
    .replace(HREF_ATTR, (whole, _q, a, b, c) => {
      const v = String(a ?? b ?? c ?? "")
        .trim()
        .toLowerCase();
      return v.startsWith("#") ||
        v.startsWith("data:image/png") ||
        v.startsWith("data:image/jpeg") ||
        v.startsWith("data:image/webp")
        ? whole
        : "";
    });
};

export type LogoResult =
  | { ok: true; url: string }
  | { error: string; ok: false };

const storeSvg = async (raw: string): Promise<LogoResult> => {
  const svg = cleanSvg(raw);
  return svg
    ? { ok: true, url: await persistSvgText(svg, PREFIX) }
    : { error: "That logo isn't a usable SVG.", ok: false };
};

/** Keeps a scanned logo: `svg` markup as it was copied, or an image at `src`. */
export const adoptSiteLogo = async (input: {
  src?: unknown;
  svg?: unknown;
}): Promise<LogoResult> => {
  if (typeof input.svg === "string") {
    return await storeSvg(input.svg);
  }
  if (typeof input.src !== "string") {
    return { error: "No logo to keep.", ok: false };
  }
  const got = await fetchPublic(
    input.src,
    "image/svg+xml,image/*;q=0.9",
    MAX_LOGO_BYTES
  );
  if (!got.ok) {
    return got;
  }
  const bytes = new Uint8Array(got.body);
  const type = sniffImage(bytes);
  if (!type) {
    return { error: "That logo isn't an image.", ok: false };
  }
  if (type === "image/svg+xml") {
    return await storeSvg(new TextDecoder().decode(bytes));
  }
  return { ok: true, url: await persistBytes(got.body, PREFIX, type) };
};
