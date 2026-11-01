import { type SiteScan, sanitizeScans } from "../../config/siteScan.js";
import { scanPage } from "../../scripts/scanPage.mjs";
import { brandKitsApi } from "../services/brandKitService";

/**
 * A website's design, read in this browser: no command line, no extension.
 *
 * The server fetches the page (it can't be fetched from here across origins)
 * with its scripts stripped. It's drawn at desktop size in a hidden frame
 * sandboxed with scripts off, its own stylesheets and fonts loading against
 * its address, and the same scanner the command-line scan uses reads what
 * the browser drew. Nothing from the scanned site runs.
 *
 * A site that only draws itself with JavaScript shows little this way; the
 * command-line scan (pnpm design-md:scan) renders those fully.
 */

const WIDTH = 1440;
const HEIGHT = 900;
const SETTLE_MS = 600;
const LOAD_TIMEOUT_MS = 20_000;
const HEAD = /<head(\s[^>]*)?>/i;

/** The page, told where it lives and that it may not run scripts. */
export const withBase = (html: string, url: string): string => {
  const head = `<base href="${url.replace(/"/g, "&quot;")}"><meta http-equiv="Content-Security-Policy" content="script-src 'none'">`;
  return HEAD.test(html)
    ? html.replace(HEAD, (open) => `${open}${head}`)
    : `<head>${head}</head>${html}`;
};

const loaded = (frame: HTMLIFrameElement): Promise<void> =>
  new Promise((resolve) => {
    const done = () => resolve();
    frame.addEventListener("load", done, { once: true });
    setTimeout(done, LOAD_TIMEOUT_MS);
  });

export const scanSite = async (raw: string): Promise<SiteScan> => {
  const page = await brandKitsApi.sitePage(raw);
  const frame = document.createElement("iframe");
  // Same origin so this page can read the drawn result; no allow-scripts,
  // so nothing on the scanned site runs.
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:-${WIDTH * 2}px;top:0;width:${WIDTH}px;height:${HEIGHT}px;border:0;pointer-events:none`;
  const ready = loaded(frame);
  frame.srcdoc = withBase(page.html, page.url);
  document.body.append(frame);
  try {
    await ready;
    const win = frame.contentWindow;
    if (!win) {
      throw new Error("The page couldn't be drawn here.");
    }
    await win.document.fonts?.ready;
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const found = scanPage(win);
    const [scan] = sanitizeScans([
      { ...found, scannedAt: new Date().toISOString(), url: page.url },
    ]);
    if (!scan) {
      throw new Error("Nothing usable came back from that page.");
    }
    return scan;
  } finally {
    frame.remove();
  }
};
