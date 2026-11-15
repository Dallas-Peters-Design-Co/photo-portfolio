import type { CSSProperties } from "react";
import { useEffect } from "react";
import { fontRefStack, parseFontRef } from "../../../config/fontRef.js";
import type { ReviewConcept } from "../../../config/review.js";
import { loadFontRef } from "../../theme/remoteFonts";
import "./ReviewConceptPreview.css";

const CONCEPT_FONTS: Partial<Record<ReviewConcept["fontFamily"], string>> = {
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

const familyCss = (family: string, fontRef?: string): string => {
  const ref = fontRef ? parseFontRef(fontRef) : null;
  if (family === "brand" && ref) {
    return fontRefStack(ref);
  }
  return (
    CONCEPT_FONTS[family as keyof typeof CONCEPT_FONTS] ??
    "var(--font-sans, Arial, sans-serif)"
  );
};

export function ReviewConceptPreview({ concept }: { concept: ReviewConcept }) {
  useEffect(() => {
    if (concept.fontRef) {
      loadFontRef(concept.fontRef);
    }
    for (const element of concept.elements) {
      if (element.fontRef) {
        loadFontRef(element.fontRef);
      }
    }
  }, [concept]);

  const style: CSSProperties = {
    alignItems: ALIGN_ITEMS[concept.align],
    background: concept.background,
    borderRadius: concept.radius,
    color: concept.color,
    display: "flex",
    flexDirection: concept.direction,
    fontFamily: familyCss(concept.fontFamily, concept.fontRef),
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
              fontFamily: familyCss(element.fontFamily, element.fontRef),
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
