/**
 * The audit agent's validation of an app against each RoleModel reference.
 *
 * While it captures, the eve agent (agents/audit) checks the live app against
 * every reference in its context, one by one: the ten sections of the
 * ux-audit skill's Phase 3, the 21 Laws of UX, and the twelve design
 * references. Each check is a verdict and what was seen on which screen. The
 * editor folds them into the review as one section per group; a reference the
 * agent did not check is named there rather than silently missing.
 */

import type { ReviewDoc, ReviewSection } from "./review.js";
import { PRINCIPLE_LABELS, type PrincipleStatus, rich } from "./reviewAudit.js";

export const HEURISTIC_SECTIONS = [
  "Section 1: First Impressions & Visual Coherence",
  "Section 2: Navigation & Wayfinding",
  "Section 3: Cognitive Load & Complexity",
  "Section 4: Key Flows & Task Completion",
  "Section 5: Feedback & System Communication",
  "Section 6: Consistency & Standards",
  "Section 7: Accessibility",
  "Section 8: Mobile & Responsive Behavior",
  "Section 9: Performance Perception",
  "Section 10: Strategic & Forward-Looking Notes",
] as const;

export const LAWS_OF_UX = [
  "Miller's Law",
  "Hick's Law",
  "Tesler's Law",
  "Occam's Razor",
  "Parkinson's Law",
  "Pareto Principle",
  "Law of Proximity",
  "Law of Similarity",
  "Law of Common Region",
  "Law of Uniform Connectedness",
  "Law of Prägnanz",
  "Von Restorff Effect",
  "Serial Position Effect",
  "Fitts's Law",
  "Doherty Threshold",
  "Goal-Gradient Effect",
  "Jakob's Law",
  "Aesthetic-Usability Effect",
  "Peak-End Rule",
  "Postel's Law",
  "Zeigarnik Effect",
] as const;

export const DESIGN_REFERENCES = [
  "Accessibility",
  "Brand",
  "Charts and data",
  "Color",
  "Components",
  "Icons and imagery",
  "Motion",
  "Process and code",
  "Spacing and layout",
  "Typography",
  "UI copy",
  "UX patterns",
] as const;

const GROUPS = [
  {
    names: HEURISTIC_SECTIONS as readonly string[],
    title: "Validation: Heuristic audit",
  },
  { names: LAWS_OF_UX as readonly string[], title: "Validation: Laws of UX" },
  {
    names: DESIGN_REFERENCES as readonly string[],
    title: "Validation: Design references",
  },
];

/** Every reference the agent is asked to check, in reading order. */
export const REFERENCE_NAMES: string[] = GROUPS.flatMap((g) => g.names);

export const SEVERITIES = [
  "Critical",
  "High",
  "Medium",
  "Pattern",
  "Pass",
] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface CheckObservation {
  detail: string;
  /** The captured screen's title, as the agent named it. */
  screen: string;
  severity: Severity;
}

export interface ReferenceCheck {
  observations: CheckObservation[];
  reference: string;
  status: PrincipleStatus;
  summary: string;
}

const MAX_TEXT = 1200;
const MAX_OBSERVATIONS = 12;
const STATUSES: PrincipleStatus[] = ["pass", "opportunity", "attention"];

const str = (v: unknown, max = MAX_TEXT): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const records = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : []).filter(
    (x): x is Record<string, unknown> => typeof x === "object" && x !== null
  );

/**
 * What the agent returned, bounded and typed: only known references, the
 * first entry for each, observations capped. Text comes from a model that read
 * untrusted pages, so it is only ever stored as plain text.
 */
export const sanitizeChecks = (value: unknown): ReferenceCheck[] => {
  const seen = new Set<string>();
  const out: ReferenceCheck[] = [];
  for (const raw of records(value)) {
    const reference = str(raw.reference, 120);
    if (!REFERENCE_NAMES.includes(reference) || seen.has(reference)) {
      continue;
    }
    seen.add(reference);
    out.push({
      observations: records(raw.observations)
        .slice(0, MAX_OBSERVATIONS)
        .map((o) => ({
          detail: str(o.detail),
          screen: str(o.screen, 160),
          severity: SEVERITIES.includes(o.severity as Severity)
            ? (o.severity as Severity)
            : "Medium",
        }))
        .filter((o) => o.detail),
      reference,
      status: STATUSES.includes(raw.status as PrincipleStatus)
        ? (raw.status as PrincipleStatus)
        : "opportunity",
      summary: str(raw.summary),
    });
  }
  return out;
};

const { bulletList, labelled, paragraph, section, text } = rich;

const checkNodes = (check: ReferenceCheck) => [
  paragraph(
    text(`${check.reference} — ${PRINCIPLE_LABELS[check.status]}`, true)
  ),
  ...(check.summary ? [paragraph(text(check.summary))] : []),
  ...(check.observations.length > 0
    ? [
        bulletList(
          check.observations.map((o) =>
            labelled(
              [o.screen, o.severity].filter(Boolean).join(" · "),
              o.detail
            )
          )
        ),
      ]
    : []),
];

/** One section per group, references in reference order, gaps named. */
export const checkSections = (checks: ReferenceCheck[]): ReviewSection[] => {
  if (checks.length === 0) {
    return [];
  }
  const byName = new Map(checks.map((c) => [c.reference, c]));
  return GROUPS.map(({ names, title }) => {
    const found = names.flatMap((n) => {
      const check = byName.get(n);
      return check ? [check] : [];
    });
    const missing = names.filter((n) => !byName.has(n));
    return section(title, [
      ...found.flatMap(checkNodes),
      ...(missing.length > 0
        ? [paragraph(text(`Not checked: ${missing.join(", ")}.`, true))]
        : []),
    ]);
  });
};

/** The review with the agent's checks added after what it already holds. */
export const mergeChecks = (
  review: ReviewDoc,
  checks: ReferenceCheck[]
): ReviewDoc => ({
  ...review,
  sections: [...review.sections, ...checkSections(checks)],
});
