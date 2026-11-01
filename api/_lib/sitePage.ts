import { resolvePublicUrl } from "./publicHost.js";

/**
 * A website's HTML, for scanning in the admin's own browser.
 *
 * The browser can't fetch another site's page itself (CORS), so the server
 * does: public addresses only, every redirect hop checked the same way, size
 * capped. Scripts are stripped here and the admin renders the page in a
 * sandboxed frame with scripts off as well, so nothing on the scanned site
 * ever runs. See src/lib/scanSite.ts.
 */

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 3_000_000;
const MAX_HOPS = 5;
const SCRIPT = /<script\b[\s\S]*?<\/script\s*>/gi;
const NOSCRIPT = /<\/?noscript\b[^>]*>/gi;
const ON_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

export type SitePage =
  | { html: string; ok: true; url: string }
  | { error: string; ok: false };

/** Scripts and inline handlers out; <noscript> fallbacks kept as plain HTML. */
export const inertHtml = (html: string): string =>
  html.replace(SCRIPT, "").replace(NOSCRIPT, "").replace(ON_ATTR, "");

export const fetchSitePage = async (raw: string): Promise<SitePage> => {
  let next = raw;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each redirect is checked before it is followed
    const checked = await resolvePublicUrl(next);
    if (!checked.ok) {
      return {
        error:
          checked.reason === "private"
            ? "That address isn't on the public internet."
            : "That doesn't look like a website address.",
        ok: false,
      };
    }
    let res: Response;
    try {
      res = await fetch(checked.url, {
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return { error: "The site didn't answer.", ok: false };
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      next = new URL(location, checked.url).href;
      continue;
    }
    if (!res.ok) {
      return { error: `The site answered ${res.status}.`, ok: false };
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) {
      return { error: "That address isn't a web page.", ok: false };
    }
    const html = (await res.text()).slice(0, MAX_BYTES);
    return { html: inertHtml(html), ok: true, url: checked.url.href };
  }
  return { error: "Too many redirects.", ok: false };
};
