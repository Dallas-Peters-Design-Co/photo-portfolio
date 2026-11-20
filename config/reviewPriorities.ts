import { numberPins, type PinKind, type ReviewDoc } from "./review.js";

export const REVIEW_FIX_PRIORITIES = [
  { key: "must-fix", label: "Must fix" },
  { key: "recommended", label: "Recommended" },
  { key: "later", label: "Consider later" },
] as const;

export type ReviewFixPriority = (typeof REVIEW_FIX_PRIORITIES)[number]["key"];

const PRIORITY_BY_KIND: Partial<Record<PinKind, ReviewFixPriority>> = {
  accessibility: "must-fix",
  issue: "must-fix",
  recommendation: "recommended",
  suggestion: "later",
};

/** Actionable notes, sorted into priority groups and numbered review order. */
export const prioritizedFixes = (doc: ReviewDoc) => {
  const fixes = numberPins(doc).flatMap(({ n, pin, screen }) => {
    const priority = PRIORITY_BY_KIND[pin.kind];
    return priority ? [{ n, pin, priority, screen }] : [];
  });

  return REVIEW_FIX_PRIORITIES.flatMap(({ key }) =>
    fixes.filter((fix) => fix.priority === key)
  );
};
