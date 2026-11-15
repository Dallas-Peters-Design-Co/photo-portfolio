import type { CSSProperties } from "react";
import type { ReviewConcept } from "../../../config/review.js";
import "./ReviewConceptPreview.css";

const CONCEPT_FONTS: Record<ReviewConcept["fontFamily"], string> = {
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: "var(--font-sans, Arial, sans-serif)",
  serif: "Georgia, serif",
};

const ALIGN_ITEMS = {
  center: "center",
  end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
} as const;

export function ReviewConceptPreview({ concept }: { concept: ReviewConcept }) {
  const style: CSSProperties = {
    alignItems: ALIGN_ITEMS[concept.align],
    background: concept.background,
    borderRadius: concept.radius,
    color: concept.color,
    display: "flex",
    flexDirection: concept.direction,
    fontFamily: CONCEPT_FONTS[concept.fontFamily],
    gap: concept.gap,
    padding: concept.padding,
  };

  return (
    <div className="review-page__concept">
      <h4 className="review-page__concept-title">
        What it could look like
        {concept.title ? <span>{concept.title}</span> : null}
      </h4>
      <div
        aria-label={`${concept.title || "Interface concept"} preview`}
        className="review-page__concept-preview"
        role="img"
        style={style}
      >
        {concept.elements.map((element) => (
          <div
            key={element.id}
            style={{
              background: element.background,
              borderRadius: element.radius,
              color: element.color,
              fontFamily: CONCEPT_FONTS[element.fontFamily],
              fontSize: element.fontSize,
              fontWeight: element.fontWeight,
              lineHeight: element.lineHeight,
              padding: `${element.paddingY}px ${element.paddingX}px`,
            }}
          >
            {element.text}
          </div>
        ))}
      </div>
    </div>
  );
}
