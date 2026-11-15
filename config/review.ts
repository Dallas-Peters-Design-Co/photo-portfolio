/**
 * The shape of a review: screenshots of a site or app with numbered notes
 * pinned to them.
 *
 * Shared by the admin editor, the public page, the PDF and the API, so it
 * is validated once here. Pins are placed as fractions of the image (0 to
 * 1 on each axis) rather than pixels, so the same pin lands in the same
 * place whatever size the image is shown at.
 */

import { isFontRef } from "./fontRef.js";
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
  /** Small interface concepts attached to this note, usually a recommendation. */
  concepts?: ReviewConcept[];
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

/**
 * A titled passage of its own, read after the headline findings: strengths,
 * principles, recommendations — whatever the opening and closing do not hold.
 * An audit writes several; each is edited, renamed or removed like the rest.
 */
export interface ReviewSection {
  body: RichText;
  id: string;
  title: string;
}

export type ReviewConceptElementKind = "text" | "button";

export interface ReviewConceptElement {
  background: string;
  color: string;
  fontFamily: "sans" | "serif" | "mono" | "brand";
  fontRef?: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  id: string;
  kind: ReviewConceptElementKind;
  lineHeight: number;
  paddingX: number;
  paddingY: number;
  radius: number;
  text: string;
}

/** A small auto-layout component, drawn live on the review page. */
export interface ReviewConcept {
  align: "start" | "center" | "end" | "stretch";
  background: string;
  color: string;
  direction: "row" | "column";
  elements: ReviewConceptElement[];
  fontFamily: "sans" | "serif" | "mono" | "brand";
  fontRef?: string;
  gap: number;
  id: string;
  padding: number;
  radius: number;
  title: string;
}

export interface ReviewDoc {
  /**
   * The board this review is synced with, or null. Set by "Send to board" in
   * the review editor or by publishing from a board; both directions then
   * find each other through it (src/boards/review/).
   */
  boardId: string | null;
  closing: RichText;
  concepts: ReviewConcept[];
  intro: RichText;
  screens: ReviewScreen[];
  /** Titled passages between the headline findings and the screens. */
  sections: ReviewSection[];
  /** The headline findings, above the screens. */
  summary: RichText;
}

export const DEFAULT_REVIEW_DOC: ReviewDoc = {
  boardId: null,
  closing:
    "Happy to walk through any of this on a call. If you'd like me to take on the fixes, I'll turn the notes into a scoped proposal.",
  concepts: [],
  intro:
    "I went through the site the way a first-time visitor would and noted what helps, what gets in the way, and what I'd change. Each screen below has numbered notes; the numbers match the pins on the screenshot.",
  screens: [],
  sections: [],
  summary: "",
};

export const CAPTURE_WIDTHS = { desktop: 1440, mobile: 390 } as const;
export const MAX_REVIEW_CONCEPTS = 8;
const MAX_SCREENS = 40;
const BOARD_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SECTIONS = 12;
const MAX_CONCEPT_ELEMENTS = 20;
const MAX_PINS = 60;
const MAX_MARKS = 80;
const MAX_PEN_POINTS = 400;
const MAX_TITLE = 160;
const MAX_BODY = 4000;
const MAX_URL = 2048;
const MAX_DOC_BYTES = 400_000;
const CONCEPT_HEX_COLOR = /^#[\da-f]{3}(?:[\da-f]{3})?$/i;

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

export const cleanPin = (v: unknown): ReviewPin => {
  const raw = (v ?? {}) as Partial<ReviewPin>;
  const kind = PIN_KINDS.includes(raw.kind as PinKind)
    ? (raw.kind as PinKind)
    : "issue";
  return {
    body: str(raw.body, MAX_BODY),
    concepts: (Array.isArray(raw.concepts) ? raw.concepts : [])
      .slice(0, MAX_REVIEW_CONCEPTS)
      .map(cleanConcept),
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

const cleanSection = (v: unknown): ReviewSection => {
  const raw = (v ?? {}) as Partial<ReviewSection>;
  return {
    body: cleanRich(raw.body, MAX_DOC_BYTES / 8),
    id: str(raw.id, 64) || newItemId(),
    title: str(raw.title, MAX_TITLE),
  };
};

const cleanConceptColor = (value: unknown, fallback: string): string => {
  if (value === "transparent") {
    return value;
  }
  return typeof value === "string" && CONCEPT_HEX_COLOR.test(value)
    ? value
    : fallback;
};

const cleanConceptElement = (v: unknown): ReviewConceptElement => {
  const raw = (v ?? {}) as Partial<ReviewConceptElement>;
  const fontWeight = [400, 500, 600, 700].includes(raw.fontWeight as number)
    ? (raw.fontWeight as 400 | 500 | 600 | 700)
    : 400;
  const requestedFontFamily = ["sans", "serif", "mono", "brand"].includes(
    raw.fontFamily as string
  )
    ? (raw.fontFamily as ReviewConceptElement["fontFamily"])
    : "sans";
  const fontRef = isFontRef(raw.fontRef) ? raw.fontRef : null;
  let fontFamily = requestedFontFamily;
  if (fontFamily === "brand" && !fontRef) {
    fontFamily = "sans";
  }
  return {
    background: cleanConceptColor(raw.background, "transparent"),
    color: cleanConceptColor(raw.color, "#172033"),
    fontFamily,
    ...(fontFamily === "brand" && fontRef ? { fontRef } : {}),
    fontSize:
      typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize)
        ? Math.min(72, Math.max(10, raw.fontSize))
        : 16,
    fontWeight,
    id: str(raw.id, 64) || newItemId(),
    kind: raw.kind === "button" ? "button" : "text",
    lineHeight:
      typeof raw.lineHeight === "number" && Number.isFinite(raw.lineHeight)
        ? Math.min(2.4, Math.max(1, raw.lineHeight))
        : 1.4,
    paddingX:
      typeof raw.paddingX === "number" && Number.isFinite(raw.paddingX)
        ? Math.min(48, Math.max(0, raw.paddingX))
        : 16,
    paddingY:
      typeof raw.paddingY === "number" && Number.isFinite(raw.paddingY)
        ? Math.min(32, Math.max(0, raw.paddingY))
        : 10,
    radius:
      typeof raw.radius === "number" && Number.isFinite(raw.radius)
        ? Math.min(48, Math.max(0, raw.radius))
        : 4,
    text: str(raw.text, 500),
  };
};

const cleanConcept = (v: unknown): ReviewConcept => {
  const raw = (v ?? {}) as Partial<ReviewConcept>;
  const requestedFontFamily = ["sans", "serif", "mono", "brand"].includes(
    raw.fontFamily as string
  )
    ? (raw.fontFamily as ReviewConcept["fontFamily"])
    : "sans";
  const fontRef = isFontRef(raw.fontRef) ? raw.fontRef : null;
  let fontFamily = requestedFontFamily;
  if (fontFamily === "brand" && !fontRef) {
    fontFamily = "sans";
  }
  const align = ["start", "center", "end", "stretch"].includes(
    raw.align as string
  )
    ? (raw.align as "start" | "center" | "end" | "stretch")
    : "start";
  return {
    align,
    background: cleanConceptColor(raw.background, "#f2f4f7"),
    color: cleanConceptColor(raw.color, "#172033"),
    direction: raw.direction === "row" ? "row" : "column",
    elements: (Array.isArray(raw.elements) ? raw.elements : [])
      .slice(0, MAX_CONCEPT_ELEMENTS)
      .map(cleanConceptElement),
    fontFamily,
    ...(fontFamily === "brand" && fontRef ? { fontRef } : {}),
    gap:
      typeof raw.gap === "number" && Number.isFinite(raw.gap)
        ? Math.min(64, Math.max(0, raw.gap))
        : 12,
    id: str(raw.id, 64) || newItemId(),
    padding:
      typeof raw.padding === "number" && Number.isFinite(raw.padding)
        ? Math.min(96, Math.max(0, raw.padding))
        : 24,
    radius:
      typeof raw.radius === "number" && Number.isFinite(raw.radius)
        ? Math.min(64, Math.max(0, raw.radius))
        : 12,
    title: str(raw.title, MAX_TITLE),
  };
};

/** A document from the request or the database, bounded and typed. */
export const sanitizeReviewDoc = (value: unknown): ReviewDoc => {
  const raw = (value ?? {}) as Partial<ReviewDoc>;
  const screens = (Array.isArray(raw.screens) ? raw.screens : [])
    .slice(0, MAX_SCREENS)
    .map(cleanScreen);
  let concepts = (Array.isArray(raw.concepts) ? raw.concepts : [])
    .slice(0, MAX_REVIEW_CONCEPTS)
    .map(cleanConcept);

  // Older reviews stored examples on the document. Move them onto the first
  // recommendation (or first note) so each example travels with its screenshot.
  if (concepts.length > 0) {
    const pins = screens.flatMap((screen) => screen.pins);
    const target = pins.find((pin) => pin.kind === "recommendation") ?? pins[0];
    if (target) {
      target.concepts = [...(target.concepts ?? []), ...concepts].slice(
        0,
        MAX_REVIEW_CONCEPTS
      );
      concepts = [];
    }
  }

  let remainingConcepts = MAX_REVIEW_CONCEPTS;
  for (const screen of screens) {
    for (const pin of screen.pins) {
      pin.concepts = (pin.concepts ?? []).slice(0, remainingConcepts);
      remainingConcepts -= pin.concepts.length;
    }
  }

  return {
    boardId:
      typeof raw.boardId === "string" && BOARD_ID.test(raw.boardId)
        ? raw.boardId
        : null,
    closing: cleanRich(raw.closing, MAX_DOC_BYTES / 4),
    concepts,
    intro: cleanRich(raw.intro, MAX_DOC_BYTES / 4),
    screens,
    // Reviews written before sections existed have none, which is right.
    sections: (Array.isArray(raw.sections) ? raw.sections : [])
      .slice(0, MAX_SECTIONS)
      .map(cleanSection),
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
