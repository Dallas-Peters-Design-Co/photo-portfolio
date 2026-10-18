/**
 * The shape of a review: screenshots of a site or app with numbered notes
 * pinned to them.
 *
 * Shared by the admin editor, the public page, the PDF and the API, so it
 * is validated once here. Pins are placed as fractions of the image (0 to
 * 1 on each axis) rather than pixels, so the same pin lands in the same
 * place whatever size the image is shown at.
 */
import {
  type EditorDoc,
  isEditorDoc,
  MAX_PROPOSAL_TITLE,
  newItemId,
  type RichText,
  trimEditorDoc,
} from "./proposal.js";

export type { RichText } from "./proposal.js";
export const MAX_REVIEW_TITLE = MAX_PROPOSAL_TITLE;

export type ReviewStatus = "draft" | "published";

/** What a note is: how its pin is drawn and how the list reads. */
export type PinKind = "issue" | "recommendation" | "suggestion" | "praise";
export const PIN_KINDS: PinKind[] = [
  "issue",
  "recommendation",
  "suggestion",
  "praise",
];

/** How each kind is named wherever a note is listed. */
export const PIN_LABELS: Record<PinKind, string> = {
  issue: "Issue",
  praise: "Works well",
  recommendation: "Recommendation",
  suggestion: "Suggestion",
};

/**
 * Markup drawn over a screenshot: a box around something, a tinted
 * highlight, an arrow from one place to another, or a freehand stroke.
 *
 * Points are fractions of the image like pins, so markup stays on what it
 * marks at any size. Boxes, highlights and arrows hold two points (start
 * and end); a pen stroke holds as many as were drawn, thinned on save.
 */
export type MarkKind = "box" | "highlight" | "arrow" | "pen";
export const MARK_KINDS: MarkKind[] = ["box", "highlight", "arrow", "pen"];

export interface ReviewMark {
  id: string;
  kind: MarkKind;
  points: [number, number][];
}

export interface ReviewPin {
  body: string;
  id: string;
  kind: PinKind;
  title: string;
  /** Fraction of the image width, 0 at the left edge. */
  x: number;
  /** Fraction of the image height, 0 at the top. */
  y: number;
}

export interface ReviewImage {
  height: number;
  url: string;
  width: number;
}

export interface ReviewScreen {
  id: string;
  /** Captured or uploaded; null while the screen has no picture yet. */
  image: ReviewImage | null;
  /** Boxes, highlights, arrows and pen strokes over the picture. */
  marks: ReviewMark[];
  /** A paragraph under the title, before the numbered notes. */
  note: RichText;
  pins: ReviewPin[];
  /** Where the screenshot came from, shown as a link when set. */
  sourceUrl: string;
  title: string;
  /** How the capture was framed: "desktop" (1440) or "mobile" (390). */
  viewport: "desktop" | "mobile";
}

export interface ReviewDoc {
  closing: RichText;
  intro: RichText;
  screens: ReviewScreen[];
  /** The headline findings, above the screens. */
  summary: RichText;
}

export const DEFAULT_REVIEW_DOC: ReviewDoc = {
  closing:
    "Happy to walk through any of this on a call. If you'd like me to take on the fixes, I'll turn the notes into a scoped proposal.",
  intro:
    "I went through the site the way a first-time visitor would and noted what helps, what gets in the way, and what I'd change. Each screen below has numbered notes; the numbers match the pins on the screenshot.",
  screens: [],
  summary: "",
};

export const CAPTURE_WIDTHS = { desktop: 1440, mobile: 390 } as const;
const MAX_SCREENS = 40;
const MAX_PINS = 60;
const MAX_MARKS = 80;
const MAX_PEN_POINTS = 400;
const MAX_TITLE = 160;
const MAX_BODY = 4000;
const MAX_URL = 2048;
const MAX_DOC_BYTES = 400_000;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";

const cleanRich = (v: unknown, max: number): RichText => {
  if (isEditorDoc(v)) {
    return JSON.stringify(v).length <= max ? trimEditorDoc(v as EditorDoc) : "";
  }
  return str(v, max);
};

const fraction = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;

const positive = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;

const HTTP = /^https?:\/\//i;
const isHttpUrl = (v: string): boolean => HTTP.test(v);

const cleanImage = (v: unknown): ReviewImage | null => {
  const raw = (v ?? {}) as Partial<ReviewImage>;
  const url = str(raw.url, MAX_URL);
  const width = positive(raw.width);
  const height = positive(raw.height);
  return url && isHttpUrl(url) && width && height
    ? { height, url, width }
    : null;
};

const cleanPin = (v: unknown): ReviewPin => {
  const raw = (v ?? {}) as Partial<ReviewPin>;
  const kind = PIN_KINDS.includes(raw.kind as PinKind)
    ? (raw.kind as PinKind)
    : "issue";
  return {
    body: str(raw.body, MAX_BODY),
    id: str(raw.id, 64) || newItemId(),
    kind,
    title: str(raw.title, MAX_TITLE),
    x: fraction(raw.x),
    y: fraction(raw.y),
  };
};

const cleanPoint = (v: unknown): [number, number] | null =>
  Array.isArray(v) && v.length >= 2 ? [fraction(v[0]), fraction(v[1])] : null;

/** A mark from the request or the database, or null when it is unusable. */
export const cleanMark = (v: unknown): ReviewMark | null => {
  const raw = (v ?? {}) as Partial<ReviewMark>;
  if (!MARK_KINDS.includes(raw.kind as MarkKind)) {
    return null;
  }
  const kind = raw.kind as MarkKind;
  const points = (Array.isArray(raw.points) ? raw.points : [])
    .map(cleanPoint)
    .filter((p): p is [number, number] => p !== null);
  // A long stroke keeps its shape at every other point; past the cap it is
  // sampled evenly rather than cut off.
  const kept =
    kind === "pen"
      ? points.filter(
          (_, i) =>
            points.length <= MAX_PEN_POINTS ||
            i % Math.ceil(points.length / MAX_PEN_POINTS) === 0
        )
      : points.slice(0, 2);
  if (kept.length < 2) {
    return null;
  }
  return { id: str(raw.id, 64) || newItemId(), kind, points: kept };
};

const cleanScreen = (v: unknown): ReviewScreen => {
  const raw = (v ?? {}) as Partial<ReviewScreen>;
  const sourceUrl = str(raw.sourceUrl, MAX_URL).trim();
  return {
    id: str(raw.id, 64) || newItemId(),
    image: cleanImage(raw.image),
    marks: (Array.isArray(raw.marks) ? raw.marks : [])
      .slice(0, MAX_MARKS)
      .map(cleanMark)
      .filter((m): m is ReviewMark => m !== null),
    note: cleanRich(raw.note, MAX_DOC_BYTES / 4),
    pins: (Array.isArray(raw.pins) ? raw.pins : [])
      .slice(0, MAX_PINS)
      .map(cleanPin),
    sourceUrl: isHttpUrl(sourceUrl) ? sourceUrl : "",
    title: str(raw.title, MAX_TITLE),
    viewport: raw.viewport === "mobile" ? "mobile" : "desktop",
  };
};

/** A document from the request or the database, bounded and typed. */
export const sanitizeReviewDoc = (value: unknown): ReviewDoc => {
  const raw = (value ?? {}) as Partial<ReviewDoc>;
  return {
    closing: cleanRich(raw.closing, MAX_DOC_BYTES / 4),
    intro: cleanRich(raw.intro, MAX_DOC_BYTES / 4),
    screens: (Array.isArray(raw.screens) ? raw.screens : [])
      .slice(0, MAX_SCREENS)
      .map(cleanScreen),
    summary: cleanRich(raw.summary, MAX_DOC_BYTES / 4),
  };
};

/** The notes across every screen, numbered in reading order. */
export const numberPins = (
  doc: ReviewDoc
): { n: number; pin: ReviewPin; screen: ReviewScreen }[] => {
  const out: { n: number; pin: ReviewPin; screen: ReviewScreen }[] = [];
  let n = 0;
  for (const screen of doc.screens) {
    for (const pin of screen.pins) {
      n += 1;
      out.push({ n, pin, screen });
    }
  }
  return out;
};
