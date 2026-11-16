import type { CSSProperties } from "react";
import { conceptFontStack } from "../../../config/conceptFont.js";
import type { ReviewConceptElement } from "../../../config/reviewConcept.js";

/** A soft tint of the text, for the highlighted row when none is set. */
const TINT = "color-mix(in srgb, var(--menu-ink) 10%, transparent)";
const FAINT_LINE = "color-mix(in srgb, var(--menu-ink) 15%, transparent)";

/** A list cannot be see-through: it opens over whatever is below. */
const solid = (colour: string | undefined): string =>
  !colour || colour === "transparent" ? "#ffffff" : colour;

/**
 * What a select's or dropdown menu's open list wears, as props for the
 * list: a marker the stylesheet (ConceptElements.css) keys on, and its look
 * as custom properties. Unset parts follow the element: its fill, text,
 * border, corners and type.
 */
export const conceptMenuProps = (
  element: ReviewConceptElement
): { "data-concept-menu": ""; style: CSSProperties } => {
  const look = element.menuLook ?? {};
  const line =
    look.borderColor ??
    (element.borderColor && element.borderColor !== "transparent"
      ? element.borderColor
      : FAINT_LINE);
  return {
    "data-concept-menu": "",
    style: {
      "--menu-bg": solid(look.background ?? element.background),
      "--menu-hl": look.highlight ?? TINT,
      "--menu-hl-ink": look.highlightColor ?? "var(--menu-ink)",
      "--menu-ink": look.color ?? element.color,
      "--menu-line": line,
      "--menu-radius": `${look.radius ?? element.radius}px`,
      fontFamily: conceptFontStack(
        element.fontFamily,
        element.fontRef,
        element.fontId
      ),
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
    } as CSSProperties,
  };
};
