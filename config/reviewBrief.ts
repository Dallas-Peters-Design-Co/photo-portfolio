/**
 * A review's brief: what the client asked the review to cover, pasted in as
 * written (meeting notes, an email, a scope), and the audit's account of
 * whether each thing it asks for was covered.
 *
 * The brief steers both agents. The sign-in capture visits the areas it
 * names first; the audit works to its scope and rules and then lists every
 * item it asks for as covered, partly covered or missing, with where. That
 * list is for the designer, so nothing is dropped before the readout.
 *
 * Both are private to the editor: the public copy of a review leaves them
 * out (api/reviews/[slug].ts).
 */

export type CoverageStatus = "covered" | "partial" | "missing";

export const COVERAGE_STATUSES: CoverageStatus[] = [
  "covered",
  "partial",
  "missing",
];

export interface BriefCoverage {
  /** One thing the brief asks for, in a few words. */
  item: string;
  status: CoverageStatus;
  /** The screens and findings that cover it, or what is still needed. */
  where: string;
}

/** Long enough for an hour's meeting notes. */
export const MAX_BRIEF = 20_000;
const MAX_COVERAGE = 60;
const MAX_ITEM = 200;
const MAX_WHERE = 600;

export const cleanBrief = (value: unknown): string =>
  typeof value === "string" ? value.trim().slice(0, MAX_BRIEF) : "";

export const cleanCoverage = (value: unknown): BriefCoverage[] =>
  (Array.isArray(value) ? value : [])
    .filter(
      (c): c is Record<string, unknown> => typeof c === "object" && c !== null
    )
    .slice(0, MAX_COVERAGE)
    .map((c) => ({
      item: typeof c.item === "string" ? c.item.trim().slice(0, MAX_ITEM) : "",
      status: COVERAGE_STATUSES.includes(c.status as CoverageStatus)
        ? (c.status as CoverageStatus)
        : "missing",
      where:
        typeof c.where === "string" ? c.where.trim().slice(0, MAX_WHERE) : "",
    }))
    .filter((c) => c.item);
