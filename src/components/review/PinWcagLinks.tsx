import type { PinWcag } from "../../../config/review.js";
import { wcagCriterion, wcagLabel, wcagUrl } from "../../../config/wcag.js";

/**
 * What an accessibility note fails, each WCAG criterion linked to the W3C
 * page that explains how to meet it; and, for a scanned rule no criterion
 * covers, the rule's own page. On the review page and in the editor alike.
 */
export function PinWcagLinks({
  className,
  wcag,
}: {
  className?: string;
  wcag?: PinWcag;
}) {
  if (!wcag) {
    return null;
  }
  const criteria = wcag.criteria
    .map(wcagCriterion)
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
  if (criteria.length === 0 && !wcag.ruleUrl) {
    return null;
  }
  return (
    <ul aria-label="WCAG criteria this fails" className={className}>
      {criteria.map((criterion) => (
        <li key={criterion.number}>
          Fails WCAG {wcagLabel(criterion)}.{" "}
          <a
            href={wcagUrl(criterion)}
            rel="noopener noreferrer"
            target="_blank"
          >
            How to fix it (W3C)
          </a>
        </li>
      ))}
      {wcag.ruleUrl ? (
        <li>
          <a href={wcag.ruleUrl} rel="noopener noreferrer" target="_blank">
            {criteria.length > 0 ? "About this check" : "How to fix it"}
            {wcag.rule ? ` (${wcag.rule})` : ""}
          </a>
        </li>
      ) : null}
    </ul>
  );
}
