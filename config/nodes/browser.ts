import type { NodeType } from "../nodeTypes.js";
import { OUTPUT_PORT_KEY } from "../ports.js";
import {
  cleanMark,
  cleanPin,
  type ReviewMark,
  type ReviewPin,
} from "../review.js";

/**
 * A browser on the board: open a site (signed in, if it needs it), click
 * around it, and screenshot the page you end up on. The screenshot is the
 * node's picture from then on, wired out like any image, marked up in place,
 * with numbered notes beside it; publishing a review gathers every one
 * (src/boards/review/publishReview.ts).
 *
 * Everything lives in the node's config:
 *
 *   url, pageUrl      where it started, and where it is now
 *   viewport          desktop (1440) or mobile (390) wide
 *   sealedLogin       the login, sealed by the server (api/_lib/sealed.ts);
 *                     loginUser is just the name, to show whose it is
 *   session           the site's cookies after the last step, also sealed
 *   captureUrl, captureWidth, captureHeight
 *                     the screenshot, once taken
 *   marks, notes      markup on the screenshot and its numbered notes, in
 *                     the review's own shapes (config/review.ts)
 *
 * No capability: it never spends anything.
 */
export const BROWSER: NodeType = {
  id: "browser",
  inputs: [],
  label: "Browser",
  outputs: [{ key: OUTPUT_PORT_KEY, label: "Screenshot", type: "image" }],
  settings: [],
};

export type BrowserViewport = "desktop" | "mobile";

export interface BrowserCapture {
  height: number;
  url: string;
  width: number;
}

export interface BrowserNodeConfig {
  capture: BrowserCapture | null;
  loginUser: string;
  marks: ReviewMark[];
  notes: ReviewPin[];
  pageUrl: string;
  sealedLogin: string;
  session: string;
  title: string;
  url: string;
  viewport: BrowserViewport;
}

const MAX_URL = 2048;
/** A sealed session is the site's cookies, base64'd: room for a busy site's. */
const MAX_SEALED_SESSION = 220_000;
const MAX_SEALED_LOGIN = 4000;
const MAX_NOTES = 60;
const MAX_MARKS = 80;
const HTTP = /^https?:\/\//i;

const text = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";

const size = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;

const captureOf = (source: Record<string, unknown>): BrowserCapture | null => {
  const url = text(source.captureUrl, MAX_URL);
  const width = size(source.captureWidth);
  const height = size(source.captureHeight);
  return HTTP.test(url) && width && height ? { height, url, width } : null;
};

/** A browser node's config, read with every default filled in. */
export const browserConfigOf = (
  config: Record<string, unknown> | null | undefined
): BrowserNodeConfig => {
  const source = config ?? {};
  return {
    capture: captureOf(source),
    loginUser: text(source.loginUser, 200),
    marks: Array.isArray(source.marks) ? (source.marks as ReviewMark[]) : [],
    notes: Array.isArray(source.notes) ? (source.notes as ReviewPin[]) : [],
    pageUrl: text(source.pageUrl, MAX_URL),
    sealedLogin: text(source.sealedLogin, MAX_SEALED_LOGIN),
    session: text(source.session, MAX_SEALED_SESSION),
    title: text(source.title, 200),
    url: text(source.url, MAX_URL),
    viewport: source.viewport === "mobile" ? "mobile" : "desktop",
  };
};

/**
 * What the board save keeps of a browser node's config: the fields above,
 * bounded, with marks and notes cleaned the way a review's are.
 */
export const cleanBrowserConfig = (raw: unknown): Record<string, unknown> => {
  const source = (raw ?? {}) as Record<string, unknown>;
  const read = browserConfigOf(source);
  const out: Record<string, unknown> = {
    loginUser: read.loginUser,
    marks: read.marks
      .slice(0, MAX_MARKS)
      .map(cleanMark)
      .filter((m): m is ReviewMark => m !== null),
    notes: read.notes.slice(0, MAX_NOTES).map(cleanPin),
    pageUrl: HTTP.test(read.pageUrl) ? read.pageUrl : "",
    sealedLogin: read.sealedLogin,
    session: read.session,
    title: read.title,
    url: HTTP.test(read.url) ? read.url : "",
    viewport: read.viewport,
  };
  if (read.capture) {
    out.captureUrl = read.capture.url;
    out.captureWidth = read.capture.width;
    out.captureHeight = read.capture.height;
  }
  return out;
};
