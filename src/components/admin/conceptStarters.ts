import type { BrandKitDoc } from "../../../config/brandKit.js";
import {
  type ConceptTable,
  DEFAULT_TABLE,
} from "../../../config/conceptTable.js";
import type {
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";

/**
 * Where new elements start: the kit's palette colour for a role, and the
 * starting look of the kinds that need more than colour and type.
 */

export const paletteColor = (
  doc: BrandKitDoc | null | undefined,
  roles: string[],
  fallback: string
): string =>
  doc?.palette.find((entry) => roles.includes(entry.role.trim().toLowerCase()))
    ?.value ?? fallback;

/**
 * A new table's sample, drawn with the kit's own components: its Status and
 * Tags follow the first Badge style, and when there is a Button style an
 * Action column of buttons follows it.
 */
export const tableFromKit = (brandDoc?: BrandKitDoc | null): ConceptTable => {
  const styles = brandDoc?.componentStyles ?? [];
  const badge = styles.find((style) => style.kind === "badge");
  const button = styles.find((style) => style.kind === "button");
  const columns = DEFAULT_TABLE.columns.map((column) =>
    badge && (column.kind === "tag" || column.kind === "chips")
      ? { ...column, styleId: badge.id }
      : column
  );
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

/** A badge starts as a soft tinted pill: light fill, strong text, thin edge. */
export const badgeLook = (
  brandDoc?: BrandKitDoc | null
): Partial<ReviewConceptElement> => ({
  background: paletteColor(
    brandDoc,
    ["badge", "accent light", "tint"],
    "#eef4ff"
  ),
  borderColor: paletteColor(brandDoc, ["badge border", "border"], "#c7d7fe"),
  borderWidth: 1,
  color: paletteColor(brandDoc, ["badge ink", "accent", "primary"], "#3538cd"),
  radius: 999,
});

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
    },
  };
};
