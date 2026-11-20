import { presetOf } from "./conceptShadow.js";
import type { ConceptStyle } from "./conceptStyle.js";

/**
 * A component style as plain facts — fill, text, border, corners, padding,
 * type, shadow, hover — for the brand guide and DESIGN.md, so the two say
 * the same thing about it.
 */
export interface StyleFact {
  /** A colour to show beside the value, when the fact is one. */
  color?: string;
  label: string;
  value: string;
}

const WEIGHTS: Record<number, string> = {
  400: "regular",
  500: "medium",
  600: "semibold",
  700: "bold",
};

const kindName = (kind: string): string => {
  if (kind === "menu") {
    return "Dropdown menu";
  }
  if (kind === "buttonGroup") {
    return "Button group";
  }
  return kind[0]?.toUpperCase() + kind.slice(1);
};

export const styleTitle = (style: ConceptStyle): string =>
  `${kindName(style.kind)} / ${style.name}`;

type Look = ConceptStyle["look"];
type Fact = (look: Look) => StyleFact | null;

const colour = (label: string, value?: string): StyleFact | null =>
  value && value !== "transparent" ? { color: value, label, value } : null;

const hoverParts = ({ hover }: Look): string[] =>
  hover
    ? [
        hover.background ? `fill ${hover.background}` : "",
        hover.color ? `text ${hover.color}` : "",
        hover.borderColor ? `border ${hover.borderColor}` : "",
        hover.shadow ? "shadow" : "",
      ].filter(Boolean)
    : [];

const focusParts = ({ focus }: Look): string[] =>
  focus
    ? [
        focus.ringColor ? `ring ${focus.ringColor}` : "",
        focus.ringWidth === undefined ? "" : `${focus.ringWidth}px ring`,
        focus.background ? `fill ${focus.background}` : "",
        focus.color ? `text ${focus.color}` : "",
        focus.borderColor ? `border ${focus.borderColor}` : "",
        focus.shadow ? "shadow" : "",
      ].filter(Boolean)
    : [];

/** One per fact, in the order they read; each says nothing when unset. */
const FACTS: Fact[] = [
  ({ background }) => colour("Fill", background),
  ({ color }) => colour("Text", color),
  ({ borderColor, borderWidth }) =>
    borderColor && borderColor !== "transparent"
      ? {
          color: borderColor,
          label: "Border",
          value: `${borderWidth ?? 1}px ${borderColor}`,
        }
      : null,
  ({ radius }) =>
    radius === undefined
      ? null
      : { label: "Corners", value: radius >= 999 ? "pill" : `${radius}px` },
  ({ paddingX, paddingY }) =>
    paddingX === undefined || paddingY === undefined
      ? null
      : { label: "Padding", value: `${paddingY}px × ${paddingX}px` },
  ({ fontSize, fontWeight }) => {
    if (fontSize === undefined) {
      return null;
    }
    const weight = fontWeight ? WEIGHTS[fontWeight] : undefined;
    return {
      label: "Type",
      value: [`${fontSize}px`, weight].filter(Boolean).join(" "),
    };
  },
  ({ shadow }) =>
    shadow && shadow.opacity > 0
      ? { label: "Shadow", value: presetOf(shadow) ?? "custom" }
      : null,
  ({ accentColor }) => colour("Accent", accentColor),
  (look) => {
    const parts = hoverParts(look);
    return parts.length > 0
      ? { label: "Hover", value: parts.join(", ") }
      : null;
  },
  (look) => {
    const parts = focusParts(look);
    return parts.length > 0
      ? { label: "Focus", value: parts.join(", ") }
      : null;
  },
];

export const styleFacts = (style: ConceptStyle): StyleFact[] =>
  FACTS.map((fact) => fact(style.look)).filter(
    (fact): fact is StyleFact => fact !== null
  );

/** DESIGN.md lines: one per style, its facts in a sentence. */
export const styleLines = (styles: ConceptStyle[]): string[] =>
  styles.map(
    (style) =>
      `- **${styleTitle(style)}**: ${styleFacts(style)
        .map((fact) => `${fact.label.toLowerCase()} ${fact.value}`)
        .join("; ")}.`
  );
