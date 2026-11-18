import { type ConceptShadow, cleanShadow } from "./conceptShadow.js";
import { bounded, cleanColor, str } from "./conceptValues.js";
import { isFontRef } from "./fontRef.js";

export const TOOLTIP_SIDES = ["top", "right", "bottom", "left"] as const;
export type TooltipSide = (typeof TOOLTIP_SIDES)[number];

/** A tooltip attached to an element, with a snapshot of its kit style. */
export interface ConceptTooltip {
  interactive: boolean;
  look: {
    background: string;
    color: string;
    borderColor?: string;
    borderWidth?: number;
    fontFamily: "sans" | "serif" | "mono" | "brand" | "app";
    fontId?: string;
    fontRef?: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    paddingX: number;
    paddingY: number;
    radius: number;
    shadow?: ConceptShadow;
  };
  side: TooltipSide;
  styleId?: string;
  text: string;
}

const STYLE_ID = /^[a-z0-9-]{1,64}$/i;

export const cleanTooltip = (value: unknown): ConceptTooltip | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Partial<ConceptTooltip>;
  const look: Partial<ConceptTooltip["look"]> = raw.look ?? {};
  const side = TOOLTIP_SIDES.includes(raw.side as TooltipSide)
    ? (raw.side as TooltipSide)
    : "top";
  const fontFamily = ["sans", "serif", "mono", "brand", "app"].includes(
    look.fontFamily ?? ""
  )
    ? look.fontFamily
    : "sans";
  const shadow = cleanShadow(look.shadow);
  return {
    interactive: raw.interactive === true,
    look: {
      background: cleanColor(look.background, "#172033"),
      color: cleanColor(look.color, "#ffffff"),
      ...(look.borderColor
        ? { borderColor: cleanColor(look.borderColor, "transparent") }
        : {}),
      ...(typeof look.borderWidth === "number"
        ? { borderWidth: bounded(look.borderWidth, 0, 8, 0) }
        : {}),
      fontFamily: fontFamily ?? "sans",
      ...(fontFamily === "brand" && isFontRef(look.fontRef)
        ? { fontRef: look.fontRef }
        : {}),
      ...(fontFamily === "app" &&
      typeof look.fontId === "string" &&
      STYLE_ID.test(look.fontId)
        ? { fontId: look.fontId }
        : {}),
      fontSize: bounded(look.fontSize, 10, 72, 14),
      fontWeight: bounded(look.fontWeight, 100, 900, 400),
      lineHeight: bounded(look.lineHeight, 1, 2.4, 1.4),
      paddingX: bounded(look.paddingX, 0, 48, 12),
      paddingY: bounded(look.paddingY, 0, 32, 8),
      radius: bounded(look.radius, 0, 48, 6),
      ...(shadow ? { shadow } : {}),
    },
    side,
    ...(typeof raw.styleId === "string" && STYLE_ID.test(raw.styleId)
      ? { styleId: raw.styleId }
      : {}),
    text: str(raw.text, 500),
  };
};
