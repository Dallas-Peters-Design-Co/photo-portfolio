import type { ReviewScreen } from "../../../config/review.js";
import type { ReviewRecord } from "../../services/reviewService";

/** Draft edits preserve references outside the field that changed. Comparing
 * those references keeps autosave checks independent of the document's size. */
export const sameReviewContent = (a: ReviewRecord, b: ReviewRecord): boolean =>
  a.doc === b.doc &&
  a.brandKitId === b.brandKitId &&
  a.clientEmail === b.clientEmail &&
  a.clientName === b.clientName &&
  a.title === b.title;

/** One pass for numbering and the shared concept budget, rather than scanning
 * all of the other screens again for every screen. */
export const screenStats = (screens: ReviewScreen[], looseConcepts: number) => {
  let firstNumber = 1;
  let totalConcepts = looseConcepts;
  const stats = new Map<string, { concepts: number; firstNumber: number }>();
  for (const screen of screens) {
    const concepts = screen.pins.reduce(
      (count, pin) => count + (pin.concepts?.length ?? 0),
      0
    );
    stats.set(screen.id, { concepts, firstNumber });
    firstNumber += screen.pins.length;
    totalConcepts += concepts;
  }
  return { stats, totalConcepts };
};
