import type { BrandKitDoc } from "./brandKit.js";
import { PANEL_CHEVRON } from "./conceptIcon.js";
import { columnStyleOf } from "./conceptStyle.js";
import { type ConceptTable, DEFAULT_TABLE } from "./conceptTable.js";
import { paintFallback, paletteIds, paletteToken } from "./paletteBinding.js";
import type {
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "./reviewConcept.js";
import { contrastRatio, inkOn } from "./theme.js";

/**
 * Where new elements start: the kit's palette colour for a role, and the
 * starting look of the kinds that need more than colour and type.
 */

export const paletteColor = (
  doc: BrandKitDoc | null | undefined,
  roles: string[],
  fallback: string
): string => {
  const palette = doc?.palette ?? [];
  const index = palette.findIndex((entry) =>
    roles.includes(entry.role.trim().toLowerCase())
  );
  return index < 0
    ? fallback
    : paletteToken(paletteIds(palette)[index], palette[index].value);
};

/**
 * Status, Tags and Action start with the kit's matching component styles.
 */
export const tableFromKit = (brandDoc?: BrandKitDoc | null): ConceptTable => {
  const styles = brandDoc?.componentStyles ?? [];
  const button = styles.find((style) => style.kind === "button");
  const columns = DEFAULT_TABLE.columns.map((column) => {
    const style = columnStyleOf(column, styles);
    return style ? { ...column, styleId: style.id } : column;
  });
  return button
    ? {
        columns: [
          ...columns,
          { kind: "button", label: "Action", styleId: button.id },
        ],
        rows: DEFAULT_TABLE.rows.map((row) => [...row, "Open"]),
      }
    : { ...DEFAULT_TABLE, columns };
};

/** WCAG AA for normal text: what a starting colour must reach on its fill. */
const READABLE = 4.5;

/**
 * The first of the kit's colours for these roles that can be read on
 * `ground`, then its ink, then the fallback; failing all, black or white.
 * A kit's accent is often a light colour (a pale yellow), and a badge set in
 * it on a light fill came out all but white.
 */
export const readableColor = (
  doc: BrandKitDoc | null | undefined,
  roles: string[],
  ground: string,
  fallback: string
): string =>
  [
    ...roles.map((role) => paletteColor(doc, [role], "")),
    paletteColor(doc, ["ink", "text"], ""),
    fallback,
  ].find(
    (color) =>
      color &&
      contrastRatio(paintFallback(color), paintFallback(ground)) >= READABLE
  ) ?? inkOn(paintFallback(ground));

/** A badge starts as a soft tinted pill: light fill, strong text, thin edge. */
export const badgeLook = (
  brandDoc?: BrandKitDoc | null
): Partial<ReviewConceptElement> => {
  const background = paletteColor(
    brandDoc,
    ["badge", "accent light", "tint"],
    "#eef4ff"
  );
  return {
    background,
    borderColor: paletteColor(brandDoc, ["badge border", "border"], "#c7d7fe"),
    borderWidth: 1,
    color: readableColor(
      brandDoc,
      ["badge ink", "accent", "primary"],
      background,
      "#3538cd"
    ),
    radius: 999,
  };
};

/**
 * A tag starts as a quiet chip: no fill colour of its own, plain ink, a thin
 * grey edge and small square-ish corners, so it reads as a label, not a state.
 */
export const tagLook = (
  brandDoc?: BrandKitDoc | null
): Partial<ReviewConceptElement> => {
  const background = paletteColor(brandDoc, ["surface", "muted"], "#f9fafb");
  return {
    background,
    borderColor: paletteColor(brandDoc, ["border"], "#d0d5dd"),
    borderWidth: 1,
    color: readableColor(brandDoc, ["ink", "text"], background, "#344054"),
    radius: 4,
  };
};

/** A progress bar starts in the kit's accent on a light grey track, rounded. */
export const progressLook = (
  brandDoc?: BrandKitDoc | null
): Partial<ReviewConceptElement> => ({
  accentColor: paletteColor(
    brandDoc,
    ["accent", "primary", "button"],
    "#3538cd"
  ),
  background: paletteColor(brandDoc, ["track", "muted"], "#e4e7ec"),
  barHeight: 8,
  progress: 60,
  radius: 999,
  showValue: true,
});

/**
 * A panel starts as a quiet outlined surface with lines between its slots,
 * and a sample in each so the slots show what they are for: a count beside
 * the title, a progress bar and a checkbox in the body, an action below.
 * The slots carry the spacing, so the panel itself has no padding.
 */
/**
 * A panel's close control for its hide slot: an icon-only button, so it has
 * every button setting (fill, border, corners, shadow, padding, icon colour
 * and size, hover) and can follow a kit button style. A clear round chevron to start.
 */
export const closeButton = (
  make: (
    kind: ReviewConceptElementKind,
    brandDoc?: BrandKitDoc | null
  ) => ReviewConceptElement,
  brandDoc?: BrandKitDoc | null
): ReviewConceptElement => {
  // Clear, in the kit's ink, on whatever the panel is: a kit's "surface"
  // can be a brand colour (one was orange), and a close control filled with
  // it shouted louder than the panel's own content. The kit sets its own in
  // the panel style's close slot.
  const ground = paletteColor(brandDoc, ["background", "paper"], "#ffffff");
  const ink = readableColor(brandDoc, ["ink", "text"], ground, "#344054");
  return {
    ...make("button", brandDoc),
    background: "transparent",
    borderColor: "transparent",
    borderWidth: 0,
    color: ink,
    hover: { background: paletteColor(brandDoc, ["border"], "#e4e7ec") },
    iconColor: ink,
    ...PANEL_CHEVRON,
    iconSize: 16,
    paddingX: 8,
    paddingY: 8,
    radius: 999,
    text: "",
  };
};

export const panelLook = (
  brandDoc: BrandKitDoc | null | undefined,
  /** createConceptElement, passed in: it calls this. */
  make: (
    kind: ReviewConceptElementKind,
    brandDoc?: BrandKitDoc | null
  ) => ReviewConceptElement
): Partial<ReviewConceptElement> => {
  const sample = (
    kind: ReviewConceptElementKind,
    text: string
  ): ReviewConceptElement => ({ ...make(kind, brandDoc), text });
  return {
    borderColor: paletteColor(
      brandDoc,
      ["border", "outline", "stroke"],
      "#e4e7ec"
    ),
    dividers: true,
    paddingX: 0,
    paddingY: 0,
    radius: 12,
    slots: {
      body: {
        elements: [
          sample("progress", "Review progress"),
          sample("checkbox", "Select all"),
        ],
        gap: 12,
        layout: "column",
        paddingX: 16,
        paddingY: 16,
      },
      footer: {
        elements: [sample("button", "+ New item")],
        layout: "row",
        paddingX: 16,
        paddingY: 12,
      },
      header: {
        align: "center",
        elements: [sample("badge", "3")],
        layout: "row",
        paddingX: 16,
        paddingY: 12,
      },
      // Its ✕, in the top-right corner: a click slides the panel away.
      hide: { elements: [closeButton(make, brandDoc)] },
    },
  };
};

/**
 * A logo starts as the kit's first logo, 32 px high, on nothing: no fill, no
 * padding, so it sits in a navbar or a card as the mark itself.
 */
export const logoLook = (
  brandDoc?: BrandKitDoc | null
): Partial<ReviewConceptElement> => ({
  background: "transparent",
  logoHeight: 32,
  ...(brandDoc?.logos[0]?.url ? { logoUrl: brandDoc.logos[0].url } : {}),
  paddingX: 0,
  paddingY: 0,
  radius: 0,
});

/**
 * A navbar starts as a full-width bar on the kit's paper with a line under
 * it: the logo at the start (its header slot), links in the middle (body),
 * and a sign-in link and a button at the end (footer). Each slot is a row;
 * the slots carry the spacing, so the bar has no padding of its own.
 */
export const navbarLook = (
  brandDoc: BrandKitDoc | null | undefined,
  make: (
    kind: ReviewConceptElementKind,
    brandDoc?: BrandKitDoc | null
  ) => ReviewConceptElement
): Partial<ReviewConceptElement> => {
  const sample = (
    kind: ReviewConceptElementKind,
    text: string
  ): ReviewConceptElement => ({ ...make(kind, brandDoc), text });
  return {
    background: paletteColor(brandDoc, ["background", "paper"], "#ffffff"),
    borderColor: paletteColor(
      brandDoc,
      ["border", "outline", "stroke"],
      "#e4e7ec"
    ),
    paddingX: 0,
    paddingY: 0,
    radius: 0,
    slots: {
      body: {
        align: "center",
        elements: [
          sample("link", "Product"),
          sample("link", "Pricing"),
          sample("link", "About"),
        ],
        gap: 24,
        justify: "center",
        layout: "row",
        paddingY: 12,
      },
      footer: {
        align: "center",
        elements: [sample("link", "Sign in"), sample("button", "Get started")],
        gap: 12,
        layout: "row",
        paddingX: 20,
        paddingY: 12,
      },
      header: {
        align: "center",
        elements: [make("logo", brandDoc)],
        layout: "row",
        paddingX: 20,
        paddingY: 12,
      },
    },
  };
};
