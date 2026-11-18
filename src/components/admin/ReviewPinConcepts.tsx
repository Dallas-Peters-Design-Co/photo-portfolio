import { memo, useCallback } from "react";
import type { BrandKitDoc } from "../../../config/brandKit.js";
import type { ReviewPin } from "../../../config/review.js";
import type { ReviewConcept } from "../../../config/reviewConcept.js";
import { ReviewConceptsEditor } from "./ReviewConceptsEditor";

const EMPTY_CONCEPTS: ReviewConcept[] = [];

/** Typing a note or moving a pin doesn't change its component editor. */
export const ReviewPinConcepts = memo(function PinConcepts({
  brandDoc,
  concepts = EMPTY_CONCEPTS,
  maxConcepts,
  onUpdate,
  pinId,
}: {
  brandDoc?: BrandKitDoc | null;
  concepts?: ReviewConcept[];
  maxConcepts: number;
  onUpdate: (id: string, patch: Partial<ReviewPin>) => void;
  pinId: string;
}) {
  const change = useCallback(
    (next: ReviewConcept[]) => onUpdate(pinId, { concepts: next }),
    [onUpdate, pinId]
  );
  return (
    <ReviewConceptsEditor
      brandDoc={brandDoc}
      concepts={concepts}
      maxConcepts={maxConcepts}
      onChange={change}
    />
  );
});
