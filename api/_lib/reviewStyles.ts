import {
  applyConceptStyles,
  applyReviewStyles,
} from "../../config/conceptStyle.js";
import { refreshPalettePaints } from "../../config/paletteBinding.js";
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
      const palette = kit?.resolvedDoc.palette ?? [];
      const resolvedScreen = {
        ...screen,
        pins: screen.pins.map((pin) =>
          pin.concepts
            ? { ...pin, concepts: refreshPalettePaints(pin.concepts, palette) }
            : pin
        ),
      };
      const page = screen.pageDesign;
      if (!page?.kitId || page.kitId === review.brandKitId) {
        return page
          ? {
              ...resolvedScreen,
              pageDesign: {
                ...page,
                concept: refreshPalettePaints(page.concept, palette),
              },
            }
          : resolvedScreen;
      }
      const own = await getKit(page.kitId);
      const concept =
        applyConceptStyles(
          [page.concept],
          own?.resolvedDoc.componentStyles ?? []
        )[0] ?? page.concept;
      return {
        ...resolvedScreen,
        pageDesign: {
          ...page,
          concept: refreshPalettePaints(
            concept,
            own?.resolvedDoc.palette ?? []
          ),
        },
      };
    })
  );
  return {
    ...review,
    doc: {
      ...doc,
      concepts: refreshPalettePaints(
        doc.concepts,
        kit?.resolvedDoc.palette ?? []
      ),
      screens,
    },
  };
};
