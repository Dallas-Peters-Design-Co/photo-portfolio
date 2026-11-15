import type {
  PaletteEntry,
  TypefaceEntry,
} from "../../../../config/brandKit.js";
import type { TextStyle } from "../../../../config/textStyle.js";
import { FONT_CHOICES } from "../../../../config/theme.js";
import type { TypeScale, TypeStyle } from "../../../../config/typeScale.js";
import { BLANK_ITEM } from "../../../components/admin/boardEditor/placement";
import type { Faces } from "../../../components/typeScale/faces";
import type { BoardItem } from "../../../types";
import { newItemId } from "../../io/newItemId";
import type { StudioComposition } from "../composition";

const PAD = 40;
const GUTTER = 240;
const ROW_GAP = 28;

const sampleFor = (style: TypeStyle): string =>
  style.face === "headline"
    ? "The quick brown fox"
    : "Sphinx of black quartz, judge my vow";

const familyOf = (face: TypefaceEntry | undefined): string | null =>
  face?.ref ??
  FONT_CHOICES.find((font) => font.label === face?.name)?.id ??
  null;

const paletteColor = (
  palette: PaletteEntry[],
  role: string,
  fallback: string
): string =>
  palette.find((entry) => entry.role.toLowerCase() === role)?.value ?? fallback;

const textItem = (
  body: string,
  box: { height: number; width: number; x: number; y: number },
  size: number,
  color: string,
  style: Partial<TextStyle> = {}
): BoardItem => ({
  ...BLANK_ITEM,
  ...box,
  body,
  fontSize: size,
  id: newItemId(),
  kind: "text",
  textStyle: {
    align: "left",
    color,
    family: "public-sans",
    italic: null,
    letterSpacing: null,
    lineHeight: 1.4,
    transform: null,
    weight: 400,
    ...style,
  },
  z: 0,
});

/** The specimen is real text at the scale's sizes, with a normal editable backdrop. */
export const typeSpecimen = (
  scale: TypeScale,
  faces: Faces,
  title: string,
  palette: PaletteEntry[] = []
): StudioComposition => {
  const ink = paletteColor(palette, "ink", "#172033");
  const paper = paletteColor(palette, "background", "#ffffff");
  const sampleWidth = Math.max(
    800,
    ...scale.styles.map((style) =>
      Math.ceil(
        sampleFor(style).length * style.size * (1 + Math.abs(style.tracking))
      )
    )
  );
  const width = PAD * 2 + GUTTER + sampleWidth;
  const items = [
    textItem(
      `${title} type scale`,
      { height: 40, width: width - PAD * 2, x: PAD, y: PAD },
      24,
      ink,
      { weight: 600 }
    ),
  ];
  let y = PAD + 72;
  for (const style of scale.styles) {
    const height = Math.max(
      64,
      Math.ceil(style.size * Math.max(style.lineHeight, 1.5))
    );
    items.push(
      textItem(
        style.name,
        { height: 22, width: GUTTER - 24, x: PAD, y },
        14,
        ink,
        { weight: 600 }
      ),
      textItem(
        `${style.size}px / ${style.lineHeight} · ${style.weight} · ${style.tracking}em`,
        { height: 40, width: GUTTER - 24, x: PAD, y: y + 24 },
        12,
        ink
      ),
      textItem(
        sampleFor(style),
        { height, width: sampleWidth, x: PAD + GUTTER, y },
        style.size,
        ink,
        {
          family: familyOf(faces[style.face]),
          letterSpacing: style.tracking,
          lineHeight: style.lineHeight,
          transform: style.case,
          weight: style.weight,
        }
      )
    );
    y += height + ROW_GAP;
  }
  const height = y + PAD;
  const background: BoardItem = {
    ...BLANK_ITEM,
    config: {
      fill: paper,
      opacity: 1,
      stroke: "#00000000",
      strokeWidth: 0,
      tool: "rect",
    },
    height,
    id: newItemId(),
    kind: "drawing",
    width,
    x: 0,
    y: 0,
    z: 0,
  };
  return {
    height,
    items: [background, ...items],
    title: `${title} type scale`,
    width,
  };
};
