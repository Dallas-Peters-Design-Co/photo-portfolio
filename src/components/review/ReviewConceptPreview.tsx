import type { CSSProperties } from "react";
import { useEffect } from "react";
import { conceptFontStack } from "../../../config/conceptFont.js";
import { everyElement } from "../../../config/conceptSlots.js";
import {
  ALIGN_ITEMS,
  type ReviewConcept,
} from "../../../config/reviewConcept.js";
import type { FontId } from "../../../config/theme.js";
import { loadFont } from "../../theme/fonts";
import { loadFontRef } from "../../theme/remoteFonts";
import { ReviewConceptElementView } from "./ReviewConceptElementView";
import "./ReviewConceptPreview.css";

export function ReviewConceptPreview({ concept }: { concept: ReviewConcept }) {
  useEffect(() => {
    if (concept.fontRef) {
      loadFontRef(concept.fontRef);
    }
    if (concept.fontId) {
      void loadFont(concept.fontId as FontId);
    }
    for (const element of everyElement(concept.elements)) {
      if (element.fontRef) {
        loadFontRef(element.fontRef);
      }
      if (element.fontId) {
        void loadFont(element.fontId as FontId);
      }
    }
  }, [concept]);

  const style = {
    alignItems: ALIGN_ITEMS[concept.align],
    background: concept.background,
    borderRadius: concept.radius,
    color: concept.color,
    display: "flex",
    flexDirection: concept.direction,
    fontFamily: conceptFontStack(
      concept.fontFamily,
      concept.fontRef,
      concept.fontId
    ),
    gap: concept.gap,
    padding: concept.padding,
    ...(concept.itemWidth
      ? { "--concept-item-width": `${concept.itemWidth}px` }
      : {}),
  } as CSSProperties;

  return (
    <div className="review-page__concept">
      <h4 className="review-page__concept-title">
        What it could look like
        {concept.title ? <span>{concept.title}</span> : null}
      </h4>
      <div
        aria-label={`${concept.title || "Interface concept"} preview`}
        className="review-page__concept-preview concept-canvas"
        data-direction={concept.direction}
        data-scroll={concept.scroll || undefined}
        role="img"
        style={style}
      >
        {concept.elements.map((element) => (
          <ReviewConceptElementView element={element} key={element.id} />
        ))}
      </div>
    </div>
  );
}
