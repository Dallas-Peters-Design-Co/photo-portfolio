import { resolvePublicUrl } from "./publicHost.js";

/**
 * A website's HTML, for scanning in the admin's own browser.
 *
 * The browser can't fetch another site's page itself (CORS), so the server
 * does: public addresses only, every redirect hop checked the same way, size
 * capped. Scripts are stripped here and the admin renders the page in a
 * sandboxed frame with scripts off as well, so nothing on the scanned site
 * ever runs. See src/lib/scanSite.ts.
 *
 * The page's linked stylesheets come back too, as text: the scan reads the
 * site's colour variables from them, and a sandboxed frame can't read
 * another origin's stylesheet itself.
 */

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 3_000_000;
const MAX_HOPS = 5;
const MAX_SHEETS = 8;
const MAX_SHEET_BYTES = 1_500_000;
const MAX_CSS = 4_000_000;
const SCRIPT = /<script\b[\s\S]*?<\/script\s*>/gi;
const NOSCRIPT = /<\/?noscript\b[^>]*>/gi;
const ON_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const LINK = /<link\b[^>]*>/gi;
const STYLESHEET = /\brel\s*=\s*["']?[^"'>]*\bstylesheet\b/i;
const HREF = /\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i;
const BASE = /<base\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i;

export type SitePage =
  | { css: string; html: string; ok: true; url: string }
  | { error: string; ok: false };

/** Scripts and inline handlers out; <noscript> fallbacks kept as plain HTML. */
export const inertHtml = (html: string): string =>
  html.replace(SCRIPT, "").replace(NOSCRIPT, "").replace(ON_ATTR, "");

type Fetched =
  | { body: ArrayBuffer; ok: true; type: string; url: string }
  | { error: string; ok: false };

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36";

/**
 * GET a public address: every redirect hop checked against private and
 * internal addresses before it is followed, the body capped.
 */
export const fetchPublic = async (
  raw: string,
  accept: string,
  maxBytes: number
): Promise<Fetched> => {
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
        headers: { Accept: accept, "User-Agent": UA },
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
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) {
      return { error: "That file is too big.", ok: false };
    }
    const body = await res.arrayBuffer();
    if (body.byteLength > maxBytes) {
      return { error: "That file is too big.", ok: false };
    }
    return {
      body,
      ok: true,
      type: res.headers.get("content-type") ?? "",
      url: checked.url.href,
    };
  }
  return { error: "Too many redirects.", ok: false };
};

const first = (m: RegExpExecArray | null) => m?.[1] ?? m?.[2] ?? m?.[3] ?? "";

/** The stylesheets a page links to, as absolute addresses, in order. */
export const stylesheetsOf = (html: string, pageUrl: string): string[] => {
  const base = first(BASE.exec(html)) || pageUrl;
  const out: string[] = [];
  for (const [tag] of html.matchAll(LINK)) {
    const href = first(HREF.exec(tag));
    if (STYLESHEET.test(tag) && href) {
      try {
        out.push(new URL(href, new URL(base, pageUrl)).href);
      } catch {
        // An address that won't parse is skipped, not fatal.
      }
    }
  }
  return [...new Set(out)].slice(0, MAX_SHEETS);
};

/** The linked stylesheets' text; any that fail are left out. */
const stylesheetText = async (urls: string[]): Promise<string> => {
  const sheets = await Promise.all(
    urls.map(async (url) => {
      const got = await fetchPublic(url, "text/css,*/*;q=0.1", MAX_SHEET_BYTES);
      return got.ok && got.type.includes("css")
        ? new TextDecoder().decode(got.body)
        : "";
    })
  );
  return sheets.join("\n").slice(0, MAX_CSS);
};

export const fetchSitePage = async (raw: string): Promise<SitePage> => {
  const got = await fetchPublic(
    raw,
    "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    MAX_BYTES * 2
  );
  if (!got.ok) {
    return got;
  }
  if (!got.type.includes("html")) {
    return { error: "That address isn't a web page.", ok: false };
  }
  const html = new TextDecoder().decode(got.body).slice(0, MAX_BYTES);
  const css = await stylesheetText(stylesheetsOf(html, got.url));
  return { css, html: inertHtml(html), ok: true, url: got.url };
};
