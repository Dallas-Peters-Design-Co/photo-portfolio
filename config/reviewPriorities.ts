import { numberPins, type PinKind, type ReviewDoc } from "./review.js";

export const REVIEW_FIX_PRIORITIES = [
  { key: "must-fix", label: "Must fix" },
  { key: "recommended", label: "Recommended" },
  { key: "later", label: "Consider later" },
] as const;

export type ReviewFixPriority = (typeof REVIEW_FIX_PRIORITIES)[number]["key"];

export interface PrioritizedFix {
  anchor: string;
  context: string;
  id: string;
  label: string;
  priority: ReviewFixPriority;
  title: string;
}

const PRIORITY_BY_KIND: Partial<Record<PinKind, ReviewFixPriority>> = {
  accessibility: "must-fix",
  issue: "must-fix",
  recommendation: "recommended",
  suggestion: "later",
};

/** Actionable notes and section recommendations, ordered by priority. */
export const prioritizedFixes = (doc: ReviewDoc): PrioritizedFix[] => {
  const pinFixes = numberPins(doc).flatMap(({ n, pin, screen }) => {
    const priority = PRIORITY_BY_KIND[pin.kind];
    return priority
      ? [
          {
            anchor: `note-${pin.id}`,
            context: screen.title || "Screen",
            id: pin.id,
            label: `Note ${n}`,
            priority,
            title: pin.title || "Untitled fix",
          },
        ]
      : [];
  });
  const sectionFixes = doc.sections.flatMap((section) =>
    (section.recommendations ?? []).map((recommendation) => ({
      anchor: `review-recommendation-${recommendation.id}`,
      context: section.title || "Section",
      id: recommendation.id,
      label: "Recommendation",
      priority: "recommended" as const,
      title: recommendation.title || "Untitled recommendation",
    }))
  );
  const fixes = [...pinFixes, ...sectionFixes];

  return REVIEW_FIX_PRIORITIES.flatMap(({ key }) =>
    fixes.filter((fix) => fix.priority === key)
  );
};
