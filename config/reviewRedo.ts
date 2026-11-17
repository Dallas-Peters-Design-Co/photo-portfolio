import { isEditorDoc } from "./proposal.js";
import type { ReviewDoc, RichText } from "./review.js";
import { nodesOf } from "./reviewAudit.js";

/**
 * The review without its last UX audit, so the audit can run again and
 * replace it rather than pile a second copy on top.
 *
 * What the audit writes is marked (config/reviewAudit.ts): its pins and
 * sections carry `fromAudit`, and the paragraphs it added to the headline
 * findings are kept as `auditSummary`. Those are taken out; everything
 * written by hand stays, and so do the sign-in agent's reference checks.
 *
 * An audit run before the marks existed left none. Its sections are known
 * by their titles and go too; its pins cannot be told from hand-written
 * ones, so they stay (`legacyPins` says so).
 */

const AUDIT_TITLES = new Set([
  "Strengths",
  "Laws of UX",
  "Recommendations",
  "Further findings",
]);

/** The summary with the audit's paragraphs taken off its end, when they are. */
const summaryWithout = (summary: RichText, added?: string): RichText => {
  if (!(added && isEditorDoc(summary))) {
    return summary;
  }
  let tail: unknown[];
  try {
    tail = JSON.parse(added) as unknown[];
  } catch {
    return summary;
  }
  const nodes = nodesOf(summary);
  const end = nodes.slice(nodes.length - tail.length);
  // Only when they are still there, unchanged: an edited summary is kept.
  if (tail.length === 0 || JSON.stringify(end) !== added) {
    return summary;
  }
  return { ...summary, content: nodes.slice(0, nodes.length - tail.length) };
};

export const hasAudit = (review: ReviewDoc): boolean =>
  review.sections.some((s) => s.fromAudit || AUDIT_TITLES.has(s.title)) ||
  review.screens.some((screen) => screen.pins.some((p) => p.fromAudit));

export const withoutAudit = (
  review: ReviewDoc
): { doc: ReviewDoc; legacyPins: boolean } => {
  const marked =
    review.sections.some((s) => s.fromAudit) ||
    review.screens.some((screen) => screen.pins.some((p) => p.fromAudit));
  const { auditSummary, ...rest } = review;
  return {
    doc: {
      ...rest,
      screens: review.screens.map((screen) => ({
        ...screen,
        pins: screen.pins.filter((p) => !p.fromAudit),
      })),
      sections: review.sections.filter(
        (s) => !(s.fromAudit || (!marked && AUDIT_TITLES.has(s.title)))
      ),
      summary: summaryWithout(review.summary, auditSummary),
    },
    legacyPins: !marked,
  };
};
