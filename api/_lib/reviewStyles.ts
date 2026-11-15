import { applyReviewStyles } from "../../config/conceptStyle.js";
import { loadKit } from "./brandKitStore.js";
import type { getSql } from "./db.js";
import type { ReviewDto } from "./reviews.js";

type Sql = ReturnType<typeof getSql>;

/**
 * The review with its brand kit's current component styles applied, so a
 * concept linked to "Button / Primary" looks as the kit says today. The
 * public page cannot read kits, so this is where "linked" happens.
 *
 * A kit that fails to load leaves the concepts as they were saved: each
 * element keeps its own values for exactly this case.
 */
export const withKitStyles = async (
  sql: Sql,
  review: ReviewDto
): Promise<ReviewDto> => {
  if (!review.brandKitId) {
    return review;
  }
  const kit = await loadKit(sql, review.brandKitId).catch(() => null);
  return {
    ...review,
    doc: applyReviewStyles(review.doc, kit?.resolvedDoc.componentStyles ?? []),
  };
};
