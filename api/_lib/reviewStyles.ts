import {
  applyConceptStyles,
  applyReviewStyles,
} from "../../config/conceptStyle.js";
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
  const loading = new Map<string, ReturnType<typeof loadKit>>();
  const getKit = (id: string) => {
    let pending = loading.get(id);
    if (!pending) {
      pending = loadKit(sql, id).catch(() => null);
      loading.set(id, pending);
    }
    return pending;
  };
  const kit = review.brandKitId ? await getKit(review.brandKitId) : null;
  const doc = applyReviewStyles(
    review.doc,
    kit?.resolvedDoc.componentStyles ?? [],
    review.brandKitId
  );
  const screens = await Promise.all(
    doc.screens.map(async (screen) => {
      const page = screen.pageDesign;
      if (!page?.kitId || page.kitId === review.brandKitId) {
        return screen;
      }
      const own = await getKit(page.kitId);
      const concept =
        applyConceptStyles(
          [page.concept],
          own?.resolvedDoc.componentStyles ?? []
        )[0] ?? page.concept;
      return { ...screen, pageDesign: { ...page, concept } };
    })
  );
  return {
    ...review,
    doc: { ...doc, screens },
  };
};
