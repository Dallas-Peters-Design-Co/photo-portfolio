/**
 * What a client adds to a review: a comment, optionally pinned to a spot on a
 * screen and with their own markup drawn alongside it.
 *
 * Kept apart from the review's own notes (config/review.ts): those are the
 * designer's and are edited in the admin; these arrive from the review page
 * and are only ever added to, resolved or removed. Both live in the review's
 * doc column, under keys the doc's own sanitiser never returns (see
 * api/_lib/reviewAccess.ts), so the designer's save can't wipe a client's
 * comment and a client's comment can't reach into the designer's notes.
 */
import { newItemId } from "./proposal.js";
import { cleanMark, type ReviewMark } from "./review.js";

export interface ReviewFeedback {
  author: string;
  body: string;
  createdAt: string;
  id: string;
  /** The client's own boxes, arrows and strokes, in the screen's fractions. */
  marks: ReviewMark[];
  /** Answered or dealt with; still shown, set back. */
  resolved: boolean;
  /** The screen it's about; empty for a comment on the review as a whole. */
  screenId: string;
  /** Where it's pinned on the screen, as fractions; null when it isn't. */
  x: number | null;
  y: number | null;
}

/** Where a browser keeps a review's pass once its password was right. */
export const reviewPassKey = (slug: string): string => `review-pass:${slug}`;

export const MAX_FEEDBACK = 300;
export const MAX_FEEDBACK_BODY = 4000;
export const MAX_AUTHOR = 80;
const MAX_FEEDBACK_MARKS = 20;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\0/g, "").trim().slice(0, max) : "";

const spot = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(1, Math.max(0, v))
    : null;

/** A comment from the page or the database, bounded; null when it says nothing. */
export const cleanFeedback = (v: unknown): ReviewFeedback | null => {
  const raw = (v ?? {}) as Partial<ReviewFeedback>;
  const body = str(raw.body, MAX_FEEDBACK_BODY);
  const marks = (Array.isArray(raw.marks) ? raw.marks : [])
    .slice(0, MAX_FEEDBACK_MARKS)
    .map(cleanMark)
    .filter((m): m is ReviewMark => m !== null);
  if (!(body || marks.length > 0)) {
    return null;
  }
  const x = spot(raw.x);
  const y = spot(raw.y);
  const created = new Date(String(raw.createdAt ?? ""));
  return {
    author: str(raw.author, MAX_AUTHOR) || "Client",
    body,
    createdAt: Number.isNaN(created.getTime())
      ? new Date().toISOString()
      : created.toISOString(),
    id: str(raw.id, 64) || newItemId(),
    marks,
    resolved: raw.resolved === true,
    screenId: str(raw.screenId, 64),
    x: x !== null && y !== null ? x : null,
    y: x !== null && y !== null ? y : null,
  };
};

/** Every stored comment, cleaned, oldest first. */
export const feedbackOf = (doc: unknown): ReviewFeedback[] => {
  const raw = (doc as { feedback?: unknown } | null)?.feedback;
  return (Array.isArray(raw) ? raw : [])
    .slice(-MAX_FEEDBACK)
    .map(cleanFeedback)
    .filter((f): f is ReviewFeedback => f !== null);
};
