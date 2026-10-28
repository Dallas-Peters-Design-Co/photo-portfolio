/**
 * The page's HTML, cut down to what says something about its UX.
 *
 * Ported from fetchPage in dallasbpeters/ux-audit-app. There the HTML was
 * the whole audit; here the screenshots are, and the markup adds what a
 * picture cannot show — alt text, labels, heading order, link targets. So a
 * failure is not fatal: a client-rendered app returns an empty shell, a site
 * may refuse the request, and the screenshots carry the audit either way.
 */

const FETCH_TIMEOUT_MS = 12_000;
const MAX_CHARS = 40_000;

const SCRIPT = /<script\b[\s\S]*?<\/script>/gi;
const STYLE = /<style\b[\s\S]*?<\/style>/gi;
const SVG = /<svg\b[\s\S]*?<\/svg>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;
const DATA_ATTR = /\s+data-[a-z][a-z0-9-]*="[^"]*"/gi;
const STYLE_ATTR = /\s+style="[^"]*"/gi;
const SPACE = /\s{2,}/g;
const TAG = /<[^>]+>/g;

/** Below this much visible text, the HTML is an app shell, not a page. */
const SHELL_TEXT = 300;

export interface PageMarkup {
  html: string;
  /** True when the server saw only an empty client-side shell. */
  isShell: boolean;
}

export const cleanMarkup = (html: string): PageMarkup => {
  const clean = html
    .replace(SCRIPT, "")
    .replace(STYLE, "")
    .replace(SVG, "[svg]")
    .replace(COMMENT, "")
    .replace(DATA_ATTR, "")
    .replace(STYLE_ATTR, "")
    .replace(SPACE, " ")
    .slice(0, MAX_CHARS);
  const visible = clean.replace(TAG, " ").replace(SPACE, " ").trim();
  return { html: clean, isShell: visible.length < SHELL_TEXT };
};

export const fetchMarkup = async (url: string): Promise<PageMarkup | null> => {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return null;
    }
    return cleanMarkup(await res.text());
  } catch {
    return null;
  }
};
