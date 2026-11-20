import type { BrandComponent } from "../src/boards/components/model.js";
import { type ConceptFlex, cleanFlex } from "./conceptFlex.js";
import { type ConceptFocus, cleanFocus, takesFocus } from "./conceptFocus.js";
import { cleanGridPlacement, type GridPlacement } from "./conceptGridItem.js";
import { type ConceptHover, cleanHover, takesHover } from "./conceptHover.js";
import type { ConceptIconSvg } from "./conceptIcon.js";
import {
  cleanAvatar,
  cleanBox,
  cleanCard,
  cleanCheckbox,
  cleanIcon,
  cleanLogo,
  cleanProgress,
  cleanStateName,
  cleanToast,
} from "./conceptKinds.js";
import {
  type ConceptMenuLook,
  cleanMenuLook,
  takesMenu,
} from "./conceptMenu.js";
import type { ConceptShadow } from "./conceptShadow.js";
import {
  type ConceptSlot,
  type ConceptSlots,
  cleanSlot,
  cleanSlots,
  hasSlots,
  MAX_GROUP_DEPTH,
  SLIDE_SIDES,
  type SlideSide,
} from "./conceptSlots.js";
import {
  type ConceptStep,
  cleanFirstStep,
  cleanSteps,
  type StepEnter,
} from "./conceptSteps.js";
import { type ConceptTable, cleanTable } from "./conceptTable.js";
import { type ConceptTabLook, cleanTabLook } from "./conceptTabs.js";
import { type ConceptTooltip, cleanTooltip } from "./conceptTooltip.js";
import { bounded, cleanColor, str } from "./conceptValues.js";
import { isFontRef } from "./fontRef.js";
import type { KitShader } from "./kitShaders.js";
import { newItemId } from "./proposal.js";
import {
  cleanCanvas,
  cleanReviewCanvasComponent,
} from "./reviewCanvasComponent.js";

/**
 * Concepts in one whole review, across every note. 8 was too few: a review
 * with one sketch per recommendation reached it and the Add button went grey.
 * A concept is a few KB, so 48 keeps a full review well inside a request.
 */
export const MAX_REVIEW_CONCEPTS = 48;

/** A concept's `align` as the CSS `align-items` value it draws with. */
export const ALIGN_ITEMS = {
  center: "center",
  end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
} as const;
export const MAX_CONCEPT_ELEMENTS = 64;
const MAX_TITLE = 160;
const FONT_ID = /^[a-z0-9-]{1,64}$/;
const FONT_FAMILIES = ["sans", "serif", "mono", "brand", "app"] as const;
export const ELEMENT_KINDS: ReviewConceptElementKind[] = [
  "text",
  "icon",
  "button",
  "buttonGroup",
  "input",
  "textarea",
  "orderedList",
  "select",
  "checkbox",
  "card",
  "label",
  "badge",
  "tag",
  "link",
  "divider",
  "tabs",
  "table",
  "dialog",
  "menu",
  "toast",
  "skeleton",
  "progress",
  "panel",
  "upload",
  "group",
  "accordion",
  "avatar",
  "logo",
  "navbar",
  "canvas",
  "shader",
  "tooltip",
];
const FONT_WEIGHTS = [400, 500, 600, 700] as const;
const INPUT_TYPES = [
  "text",
  "email",
  "search",
  "url",
  "tel",
  "password",
] as const;

export type ReviewConceptElementKind =
  | "text"
  | "icon"
  | "button"
  | "buttonGroup"
  | "input"
  | "textarea"
  | "orderedList"
  | "select"
  | "checkbox"
  | "card"
  | "label"
  | "badge"
  | "tag"
  | "link"
  | "divider"
  | "tabs"
  | "table"
  | "dialog"
  | "menu"
  | "toast"
  | "skeleton"
  | "progress"
  | "panel"
  | "upload"
  | "group"
  | "accordion"
  | "avatar"
  | "logo"
  | "navbar"
  | "canvas"
  | "shader"
  | "tooltip";

/**
 * A Hugeicons export name from the site's icon set (src/cms/icons.ts), the
 * same set the page editor offers, e.g. "FavouriteIcon".
 */
export type ReviewConceptIcon = string;

export interface ReviewConceptElement {
  accentColor?: string;
  /**
   * Checkboxes: the checked box's colour (CSS accent-color). Toasts: the
   * action's colour.
   */
  accordionExpanded?: boolean;
  avatarInitials?: string;
  avatarUrl?: string;
  background: string;
  /** Progress bars: the bar's height in px. The track is `background`. */
  barHeight?: number;
  /** Cards only: the body's type size. The title uses `fontSize`. */
  bodySize?: number;
  borderBottomWidth?: number;
  /** Badges and cards: the outline colour; "transparent" draws none. */
  borderColor?: string;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  /** Optional per-side border widths in px; unset sides use borderWidth. */
  borderTopWidth?: number;
  /** Badges and cards: the outline's width in px, 0–8. Default 1. */
  borderWidth?: number;
  /** A copy of a canvas component, drawn in the concept alongside other elements. */
  canvasComponent?: BrandComponent;
  canvasSize?: { width: number; height: number };
  checked?: boolean;
  checkSize?: number;
  color: string;
  /** Cards and panels: a line between their slots. */
  dividers?: boolean;
  /**
   * Panels only: the side it slides in from when it appears, and out to
   * when its hide slot is clicked. Absent: it just appears.
   */
  flex?: ConceptFlex;
  /** How it looks while focused (see conceptFocus.ts). */
  focus?: ConceptFocus;
  fontFamily: "sans" | "serif" | "mono" | "brand" | "app";
  fontId?: string;
  fontRef?: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  fullHeight?: boolean;
  gridPlacement?: GridPlacement;
  /**
   * Groups only: the elements it holds and how it lays them out (row,
   * column or grid, gap, alignment, padding), as a slot does.
   */
  group?: ConceptSlot;
  /** How it changes under the pointer (see conceptHover.ts). */
  hover?: ConceptHover;
  /**
   * The icon's colour and size (both icons, where there are two); default to
   * the text colour, and to 1.5× type on a card, type size elsewhere.
   */
  iconColor?: string;
  /** Buttons, badges and tags: an icon after the text (a chevron, a ×). */
  iconEndName?: ReviewConceptIcon;
  /** The drawing of `iconEndName`. */
  iconEndSvg?: ConceptIconSvg;
  iconName?: ReviewConceptIcon;
  iconSize?: number;
  /** The drawing of `iconName`, so any library icon renders anywhere. */
  iconSvg?: ConceptIconSvg;
  id: string;
  inputType?: "text" | "email" | "search" | "url" | "tel" | "password";
  kind: ReviewConceptElementKind;
  lineHeight: number;
  /** A logo's height in pixels; its width follows the picture. */
  logoHeight?: number;
  /** A logo's picture: one of the brand kit's logos, by its address. */
  logoUrl?: string;
  /** Selects and dropdown menus: how the open list looks (conceptMenu.ts). */
  menuLook?: ConceptMenuLook;
  options?: string[];
  /**
   * The settings this element has set itself while following a kit style;
   * every other style setting comes from the style (see conceptStyle.ts).
   */
  overrides?: ConceptStyleKey[];
  paddingX: number;
  paddingY: number;
  panelCollapsed?: boolean;
  panelToggleSide?: "left" | "right";
  placeholder?: string;
  /** Progress bars: how far along, 0–100. The bar is `accentColor`. */
  progress?: number;
  radius: number;
  shader?: KitShader;
  shadow?: ConceptShadow;
  /** Progress bars: whether the percentage shows beside the label. */
  showValue?: boolean;
  slideFrom?: SlideSide;
  /**
   * Cards and panels: header, body and footer, each with its own layout and
   * elements (see conceptSlots.ts).
   */
  slots?: ConceptSlots;
  stateName?: string;
  /** The brand kit component style this element follows, if any. */
  styleId?: string;
  summaryIconName?: ReviewConceptIcon;
  summaryIconSvg?: ConceptIconSvg;
  /** Tabs only: indicator, active and inactive colours, height. */
  tabLook?: ConceptTabLook;
  /** Tables only: typed columns and rows (see conceptTable.ts). */
  table?: ConceptTable;
  text: string;
  /** Cards only: the title's weight; without it, bolder than the body. */
  titleWeight?: 400 | 500 | 600 | 700;
  /** Toasts: the action's label ("Undo"); none when empty. */
  toastAction?: string;
  /** Toasts: whether the close button shows. Default true. */
  toastClose?: boolean;
  /** An optional tooltip attached to this component. */
  tooltip?: ConceptTooltip;
}

/**
 * An element's look, as opposed to its content: what a brand kit component
 * style sets. `tableBorders` and `tableHeader` stand for a table's borders and
 * header colours, which live inside `table`.
 */
export const ELEMENT_STYLE_KEYS = [
  "background",
  "color",
  "fontFamily",
  "fontId",
  "fontRef",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "paddingX",
  "paddingY",
  "fullHeight",
  "radius",
  "borderColor",
  "borderWidth",
  "borderTopWidth",
  "borderLeftWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "shadow",
  "bodySize",
  "titleWeight",
  "iconColor",
  "iconSize",
  // A style may set an icon too ("Input / Search"); it is kept or overridden
  // as one choice with its drawing.
  "iconName",
  "iconSvg",
  "accentColor",
  "checkSize",
  "barHeight",
  "showValue",
  "dividers",
  "flex",
  "accordionExpanded",
  "summaryIconName",
  "summaryIconSvg",
  "panelCollapsed",
  "panelToggleSide",
  "tabLook",
  "menuLook",
  "hover",
  "focus",
  "avatarUrl",
  "avatarInitials",
  // A Logo style sets which of the kit's logos, and at what height.
  "logoUrl",
  "logoHeight",
] as const satisfies readonly (keyof ReviewConceptElement)[];

export const CONCEPT_STYLE_KEYS = [
  ...ELEMENT_STYLE_KEYS,
  "tableBorders",
  "tableHeader",
] as const;

export type ConceptStyleKey = (typeof CONCEPT_STYLE_KEYS)[number];

export const STYLE_ID = /^[a-z0-9-]{1,64}$/i;

const cleanLink = (
  raw: Partial<ReviewConceptElement>
): Pick<ReviewConceptElement, "overrides" | "styleId"> => {
  if (typeof raw.styleId !== "string" || !STYLE_ID.test(raw.styleId)) {
    return {};
  }
  const overrides = (Array.isArray(raw.overrides) ? raw.overrides : []).filter(
    (key, index, all): key is ConceptStyleKey =>
      CONCEPT_STYLE_KEYS.includes(key as ConceptStyleKey) &&
      all.indexOf(key) === index
  );
  return {
    ...(overrides.length > 0 ? { overrides } : {}),
    styleId: raw.styleId,
  };
};

export interface ReviewConcept {
  align: "start" | "center" | "end" | "stretch";
  background: string;
  /** A saved canvas component, embedded so the review can draw it. */
  canvasComponent?: BrandComponent;
  color: string;
  direction: "row" | "column";
  elements: ReviewConceptElement[];
  fontFamily: "sans" | "serif" | "mono" | "brand" | "app";
  fontId?: string;
  fontRef?: string;
  gap: number;
  id: string;
  /** Scroll only: the width in px each card or panel keeps. */
  itemWidth?: number;
  padding: number;
  radius: number;
  /**
   * Horizontal only: one line that scrolls sideways, rather than wrapping
   * onto new lines when it runs out of width.
   */
  scroll?: boolean;
  /** Step one's caption, when the concept is a sequence (conceptSteps.ts). */
  stepCaption?: string;
  /** What animates in when step one is shown again (conceptSteps.ts). */
  stepEnter?: StepEnter;
  /** Steps after the first, each a full screen (conceptSteps.ts). */
  steps?: ConceptStep[];
  /** Step one's trigger: the element whose click shows step two. */
  stepTrigger?: string;
  title: string;
}

/** The width a card or panel keeps in a scrolling row: px. */
export const ITEM_WIDTH = { default: 280, max: 640, min: 120 } as const;

/** A card keeps its title on the first line of `text` and its body below. */
export const splitCardText = (
  text: string
): { body: string; title: string } => {
  const [title = "", ...body] = text.split("\n");
  return { body: body.join("\n"), title };
};

export const joinCardText = (title: string, body: string): string =>
  body ? `${title.replace(/\n/g, " ")}\n${body}` : title.replace(/\n/g, " ");

const fontSelection = (
  familyValue: unknown,
  refValue: unknown,
  idValue: unknown
): Pick<ReviewConceptElement, "fontFamily" | "fontId" | "fontRef"> => {
  const requested = FONT_FAMILIES.includes(
    familyValue as (typeof FONT_FAMILIES)[number]
  )
    ? (familyValue as ReviewConceptElement["fontFamily"])
    : "sans";
  const ref = isFontRef(refValue) ? refValue : null;
  const id =
    typeof idValue === "string" && FONT_ID.test(idValue) ? idValue : null;
  const fontFamily =
    (requested === "brand" && !ref) || (requested === "app" && !id)
      ? "sans"
      : requested;
  return {
    fontFamily,
    ...(fontFamily === "app" && id ? { fontId: id } : {}),
    ...(fontFamily === "brand" && ref ? { fontRef: ref } : {}),
  };
};

const cleanInputType = (value: unknown): ReviewConceptElement["inputType"] =>
  INPUT_TYPES.includes(value as (typeof INPUT_TYPES)[number])
    ? (value as ReviewConceptElement["inputType"])
    : "text";

const cleanKind = (value: unknown): ReviewConceptElementKind =>
  ELEMENT_KINDS.includes(value as ReviewConceptElementKind)
    ? (value as ReviewConceptElementKind)
    : "text";

const cleanOptions = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .filter((option): option is string => typeof option === "string")
    .slice(0, 8)
    .map((option) => str(option, 100));
};

/** A card's or panel's slots and whether lines divide them. */
const cleanSlotted = (
  kind: ReviewConceptElementKind,
  raw: Partial<ReviewConceptElement>,
  depth: number
): Pick<ReviewConceptElement, "dividers" | "slots"> => {
  if (!hasSlots(kind)) {
    return {};
  }
  const slots = cleanSlots(raw.slots, depth, cleanElement);
  return {
    ...(typeof raw.dividers === "boolean" ? { dividers: raw.dividers } : {}),
    ...(slots ? { slots } : {}),
  };
};

/** A group's elements and layout; a panel's slide. */
const cleanHolder = (
  kind: ReviewConceptElementKind,
  raw: Partial<ReviewConceptElement>,
  depth: number
): Pick<
  ReviewConceptElement,
  | "group"
  | "slideFrom"
  | "panelCollapsed"
  | "panelToggleSide"
  | "accordionExpanded"
> => {
  if (kind === "accordion" && typeof raw.accordionExpanded === "boolean") {
    return { accordionExpanded: raw.accordionExpanded };
  }
  if (kind === "group" && depth < MAX_GROUP_DEPTH) {
    const group = cleanSlot(raw.group, depth, cleanElement);
    // Groups made before Full width existed had only Fill, labelled "Fill
    // the width", and were set for the group to span its row.
    const before = (raw.group as { full?: unknown } | undefined)?.full;
    if (group.fill && before === undefined) {
      const { fill: _f, ...spanning } = group;
      return { group: { ...spanning, full: true } };
    }
    return { group };
  }
  if (kind === "panel") {
    return {
      ...(raw.panelToggleSide === "left" || raw.panelToggleSide === "right"
        ? { panelToggleSide: raw.panelToggleSide }
        : {}),
      ...(raw.panelCollapsed === true ? { panelCollapsed: true } : {}),
      ...(SLIDE_SIDES.includes(raw.slideFrom as SlideSide)
        ? { slideFrom: raw.slideFrom }
        : {}),
    };
  }
  return {};
};

const cleanAttachedTooltip = (
  raw: Partial<ReviewConceptElement>,
  kind: ReviewConceptElementKind
) => {
  const tooltip = kind === "tooltip" ? undefined : cleanTooltip(raw.tooltip);
  return tooltip ? { tooltip } : {};
};

const cleanElementFocus = (
  raw: Partial<ReviewConceptElement>,
  kind: ReviewConceptElementKind
) => {
  const focus = takesFocus(kind) ? cleanFocus(raw.focus) : undefined;
  return focus ? { focus } : {};
};

export const cleanElement = (
  value: unknown,
  /** How many slots deep this element sits. */
  depth = 0
): ReviewConceptElement => {
  const raw = (value ?? {}) as Partial<ReviewConceptElement>;
  const font = fontSelection(raw.fontFamily, raw.fontRef, raw.fontId);
  const fontWeight = FONT_WEIGHTS.includes(
    raw.fontWeight as (typeof FONT_WEIGHTS)[number]
  )
    ? (raw.fontWeight as 400 | 500 | 600 | 700)
    : 400;
  const options = cleanOptions(raw.options);
  const kind = cleanKind(raw.kind);
  const table = kind === "table" ? cleanTable(raw.table) : undefined;
  const tabLook = kind === "tabs" ? cleanTabLook(raw.tabLook) : undefined;
  const menuLook = takesMenu(kind) ? cleanMenuLook(raw.menuLook) : undefined;
  const hover = takesHover(kind) ? cleanHover(raw.hover) : undefined;
  return {
    ...cleanStateName(raw.stateName),
    ...cleanCanvas(raw, kind),
    ...cleanFlex(raw.flex),
    ...cleanGridPlacement(raw.gridPlacement),
    ...cleanAttachedTooltip(raw, kind),
    background: cleanColor(raw.background, "transparent"),
    color: cleanColor(raw.color, "#172033"),
    ...font,
    fontSize: bounded(raw.fontSize, 10, 72, 16),
    fontWeight,
    id: str(raw.id, 64) || newItemId(),
    ...cleanIcon(kind, raw),
    kind,
    lineHeight: bounded(raw.lineHeight, 1, 2.4, 1.4),
    paddingX: bounded(raw.paddingX, 0, Number.POSITIVE_INFINITY, 16),
    paddingY: bounded(raw.paddingY, 0, Number.POSITIVE_INFINITY, 10),
    radius: bounded(raw.radius, 0, 48, 4),
    ...(kind === "card" ? cleanCard(raw) : {}),
    ...cleanBox(kind, raw),
    ...(kind === "checkbox" ? cleanCheckbox(raw) : {}),
    ...(kind === "toast" ? cleanToast(raw) : {}),
    ...(kind === "progress" ? cleanProgress(raw) : {}),
    ...(kind === "avatar" ? cleanAvatar(raw) : {}),
    ...(kind === "logo" ? cleanLogo(raw) : {}),
    ...cleanSlotted(kind, raw, depth),
    ...cleanHolder(kind, raw, depth),
    ...(tabLook ? { tabLook } : {}),
    ...(menuLook ? { menuLook } : {}),
    ...(hover ? { hover } : {}),
    ...cleanElementFocus(raw, kind),
    ...(table ? { table } : {}),
    ...cleanLink(raw),
    text: str(raw.text, 500),
    ...(typeof raw.placeholder === "string"
      ? { placeholder: str(raw.placeholder, 200) }
      : {}),
    ...(options ? { options } : {}),
    inputType: cleanInputType(raw.inputType),
    ...(typeof raw.checked === "boolean" ? { checked: raw.checked } : {}),
  };
};

const cleanElements = (value: unknown): ReviewConceptElement[] =>
  (Array.isArray(value) ? value : [])
    .slice(0, MAX_CONCEPT_ELEMENTS)
    .map((element) => cleanElement(element));

export const cleanConcept = (value: unknown): ReviewConcept => {
  const raw = (value ?? {}) as Partial<ReviewConcept>;
  const canvasComponent = cleanReviewCanvasComponent(raw.canvasComponent);
  const elements = canvasComponent
    ? [
        cleanElement({
          canvasComponent,
          id: `${str(raw.id, 55)}-canvas`,
          kind: "canvas",
          text: canvasComponent.name,
        }),
      ]
    : cleanElements(raw.elements);
  const steps = cleanSteps(raw.steps, cleanElements, str);
  const font = fontSelection(raw.fontFamily, raw.fontRef, raw.fontId);
  const alignOptions = ["start", "center", "end", "stretch"] as const;
  const align = alignOptions.includes(
    raw.align as (typeof alignOptions)[number]
  )
    ? (raw.align as (typeof alignOptions)[number])
    : "start";
  return {
    align,
    background: cleanColor(raw.background, "#f2f4f7"),
    color: cleanColor(raw.color, "#172033"),
    direction: raw.direction === "row" ? "row" : "column",
    elements,
    ...cleanFirstStep(raw, elements, str),
    ...font,
    gap: bounded(raw.gap, 0, 64, 12),
    id: str(raw.id, 64) || newItemId(),
    ...(typeof raw.itemWidth === "number"
      ? {
          itemWidth: Math.round(
            bounded(raw.itemWidth, ITEM_WIDTH.min, ITEM_WIDTH.max, 0)
          ),
        }
      : {}),
    padding: bounded(raw.padding, 0, Number.POSITIVE_INFINITY, 24),
    radius: bounded(raw.radius, 0, 64, 12),
    ...(raw.scroll === true && raw.direction === "row" ? { scroll: true } : {}),
    ...(steps.length > 0 ? { steps } : {}),
    title: str(raw.title, MAX_TITLE),
  };
};
