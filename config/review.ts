/**
 * The shape of a review: screenshots of a site or app with numbered notes
 * pinned to them.
 *
 * Shared by the admin editor, the public page, the PDF and the API, so it
 * is validated once here. Pins are placed as fractions of the image (0 to
 * 1 on each axis) rather than pixels, so the same pin lands in the same
 * place whatever size the image is shown at.
 */

import { type BrandMerge, cleanBrandMerge } from "./brandMerge.js";
import { cleanPageDesign, type PageDesign } from "./pageDesign.js";
import { cleanPageStyles, type PageStyles } from "./pageStyles.js";
import {
  type EditorDoc,
  isEditorDoc,
  MAX_PROPOSAL_TITLE,
  newItemId,
  type RichText,
  trimEditorDoc,
} from "./proposal.js";
import {
  type BriefCoverage,
  cleanBrief,
  cleanCoverage,
} from "./reviewBrief.js";
import {
  cleanConcept,
  MAX_REVIEW_CONCEPTS,
  type ReviewConcept,
} from "./reviewConcept.js";
import { wcagCriterion } from "./wcag.js";

export type { RichText } from "./proposal.js";
export const MAX_REVIEW_TITLE = MAX_PROPOSAL_TITLE;

export type ReviewStatus = "draft" | "published";

/** What a note is: how its pin is drawn and how the list reads. */
export type PinKind =
  | "issue"
  | "recommendation"
  | "suggestion"
  | "praise"
  | "accessibility";
export const PIN_KINDS: PinKind[] = [
  "issue",
  "recommendation",
  "suggestion",
  "praise",
  "accessibility",
];

/** How each kind is named wherever a note is listed. */
export const PIN_LABELS: Record<PinKind, string> = {
  accessibility: "Accessibility",
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

/**
 * What an accessibility note fails: the WCAG success criteria ("1.4.3"),
 * each linked to the W3C's page on meeting it (config/wcag.ts), and, when
 * the note came from a scan, the axe-core rule and its explanation.
 */
export interface PinWcag {
  criteria: string[];
  /** The axe-core rule id, e.g. "color-contrast". */
  rule?: string;
  /** The rule's own page, for rules no WCAG criterion covers. */
  ruleUrl?: string;
}

export interface ReviewPin {
  body: string;
  /** Small interface concepts attached to this note, usually a recommendation. */
  concepts?: ReviewConcept[];
  /** Written by the UX audit, so Redo audit can replace it. */
  fromAudit?: true;
  id: string;
  kind: PinKind;
  title: string;
  /** Accessibility notes only: what fails and where to read how to fix it. */
  wcag?: PinWcag;
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
  /** A live page designed on a board, in place of a screenshot. */
  pageDesign?: PageDesign;
  pins: ReviewPin[];
  /** Where the screenshot came from, shown as a link when set. */
  sourceUrl: string;
  /** The page's real styles, measured as it was captured (pageStyles.ts). */
  styles?: PageStyles;
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
  /** Written by the UX audit, so Redo audit can replace it. */
  fromAudit?: true;
  id: string;
  title: string;
}

export interface ReviewDoc {
  /**
   * The paragraphs the last audit added to the headline findings, as JSON,
   * so Redo audit can take them out again (config/reviewRedo.ts).
   */
  auditSummary?: string;
  /**
   * The board this review is synced with, or null. Set by "Send to board" in
   * the review editor or by publishing from a board; both directions then
   * find each other through it (src/boards/review/).
   */
  boardId: string | null;
  /** What the client asked the review to cover (config/reviewBrief.ts). */
  brief: string;
  /** The last audit's account of each item in the brief. */
  briefCoverage: BriefCoverage[];
  closing: RichText;
  concepts: ReviewConcept[];
  intro: RichText;
  /**
   * A brand merge writeup, read at its own page behind the review's
   * password (config/brandMerge.ts); null when the review has none.
   */
  merge: BrandMerge | null;
  screens: ReviewScreen[];
  /** Titled passages between the headline findings and the screens. */
  sections: ReviewSection[];
  /** The headline findings, above the screens. */
  summary: RichText;
}

export const DEFAULT_REVIEW_DOC: ReviewDoc = {
  boardId: null,
  brief: "",
  briefCoverage: [],
  closing:
    "Happy to walk through any of this on a call. If you'd like me to take on the fixes, I'll turn the notes into a scoped proposal.",
  concepts: [],
  intro:
    "I went through the site the way a first-time visitor would and noted what helps, what gets in the way, and what I'd change. Each screen below has numbered notes; the numbers match the pins on the screenshot.",
  merge: null,
  screens: [],
  sections: [],
  summary: "",
};

export const CAPTURE_WIDTHS = { desktop: 1440, mobile: 390 } as const;
/** Room for a brief's capture (up to 30 pages) beside the screens already there. */
const MAX_SCREENS = 60;
const BOARD_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SECTIONS = 22;
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

const RULE_ID = /^[a-z0-9-]{1,64}$/;
/** Rule pages a note may link to: the W3C's and axe-core's own. */
const RULE_URL =
  /^https:\/\/(www\.w3\.org|dequeuniversity\.com)\/[\w./?=&%-]{1,300}$/;

/** A note's WCAG details, keeping only known criteria and safe links. */
const cleanWcag = (value: unknown): { wcag?: PinWcag } => {
  if (!value || typeof value !== "object") {
    return {};
  }
  const raw = value as Partial<PinWcag>;
  const criteria = [
    ...new Set(
      (Array.isArray(raw.criteria) ? raw.criteria : []).filter(
        (n): n is string =>
          typeof n === "string" && wcagCriterion(n) !== undefined
      )
    ),
  ].slice(0, 8);
  const rule =
    typeof raw.rule === "string" && RULE_ID.test(raw.rule)
      ? raw.rule
      : undefined;
  const ruleUrl =
    typeof raw.ruleUrl === "string" && RULE_URL.test(raw.ruleUrl)
      ? raw.ruleUrl
      : undefined;
  return criteria.length > 0 || rule
    ? {
        wcag: {
          criteria,
          ...(rule ? { rule } : {}),
          ...(ruleUrl ? { ruleUrl } : {}),
        },
      }
    : {};
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
    ...(raw.fromAudit === true ? { fromAudit: true as const } : {}),
    id: str(raw.id, 64) || newItemId(),
    kind,
    title: str(raw.title, MAX_TITLE),
    ...(kind === "accessibility" ? cleanWcag(raw.wcag) : {}),
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
  const pageDesign = cleanPageDesign(raw.pageDesign);
  return {
    ...(pageDesign ? { pageDesign } : {}),
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
    ...stylesOf(raw.styles),
    title: str(raw.title, MAX_TITLE),
    viewport: raw.viewport === "mobile" ? "mobile" : "desktop",
  };
};

const stylesOf = (value: unknown): { styles?: PageStyles } => {
  const styles = cleanPageStyles(value);
  return styles ? { styles } : {};
};

const cleanSection = (v: unknown): ReviewSection => {
  const raw = (v ?? {}) as Partial<ReviewSection>;
  return {
    body: cleanRich(raw.body, MAX_DOC_BYTES / 8),
    ...(raw.fromAudit === true ? { fromAudit: true as const } : {}),
    id: str(raw.id, 64) || newItemId(),
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
    brief: cleanBrief(raw.brief),
    briefCoverage: cleanCoverage(raw.briefCoverage),
    ...(typeof raw.auditSummary === "string" &&
    raw.auditSummary.length <= MAX_DOC_BYTES / 4
      ? { auditSummary: raw.auditSummary }
      : {}),
    closing: cleanRich(raw.closing, MAX_DOC_BYTES / 4),
    concepts,
    intro: cleanRich(raw.intro, MAX_DOC_BYTES / 4),
    merge: cleanBrandMerge(raw.merge),
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
