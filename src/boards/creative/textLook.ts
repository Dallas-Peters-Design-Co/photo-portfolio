/**
 * How an editor text layer actually looks, read from its computed style, for
 * the HTML5 export to set the ad's text the same way: type, padding, and the
 * outline and box behind the words (config/textStyle.ts).
 */

export interface TextLook {
  /** The box behind the words; transparent when there is none. */
  backgroundColor?: string;
  borderRadius?: string;
  color: string;
  fontFamily: string;
  fontKerning: string;
  fontSize: string;
  fontStyle: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
  paddingBottom?: string;
  paddingLeft: string;
  /** Includes the space a middle or bottom alignment adds above the words. */
  paddingTop: string;
  textAlign: string;
  /** The outline (-webkit-text-stroke), drawn under the fill. */
  textStrokeColor?: string;
  textStrokeWidth?: string;
  textTransform: string;
}

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

export const scaled = (value: string, scale: number): string | null => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? px(n * scale) : null;
};

const CLEAR = new Set(["", "transparent", "rgba(0, 0, 0, 0)"]);

/** The outline and the box behind text, as the ad's CSS rules. */
export const effectRules = (look: TextLook, scale: number) => {
  const stroke = Number.parseFloat(look.textStrokeWidth ?? "");
  const hasStroke = stroke > 0 && !CLEAR.has(look.textStrokeColor ?? "");
  const hasBox = !CLEAR.has(look.backgroundColor ?? "");
  return {
    "-webkit-text-stroke": hasStroke
      ? `${px(stroke * scale)} ${look.textStrokeColor}`
      : null,
    background: hasBox ? (look.backgroundColor ?? null) : null,
    "border-radius":
      hasBox && look.borderRadius ? scaled(look.borderRadius, scale) : null,
    "paint-order": hasStroke ? "stroke fill" : null,
  };
};

export const lookOf = (el: HTMLElement): TextLook => {
  const css = getComputedStyle(el);
  return {
    backgroundColor: css.backgroundColor,
    borderRadius: css.borderTopLeftRadius,
    color: css.color,
    fontFamily: css.fontFamily,
    fontKerning: css.fontKerning,
    fontSize: css.fontSize,
    fontStyle: css.fontStyle,
    fontWeight: css.fontWeight,
    letterSpacing: css.letterSpacing,
    lineHeight: css.lineHeight,
    paddingBottom: css.paddingBottom,
    paddingLeft: css.paddingLeft,
    paddingTop: css.paddingTop,
    textAlign: css.textAlign,
    textStrokeColor: css.getPropertyValue("-webkit-text-stroke-color"),
    textStrokeWidth: css.getPropertyValue("-webkit-text-stroke-width"),
    textTransform: css.textTransform,
  };
};
