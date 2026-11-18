import type { BrandKitDoc, TypefaceEntry } from "./brandKit.js";
import { DEFAULT_SHADOW } from "./conceptShadow.js";
import {
  badgeLook,
  logoLook,
  navbarLook,
  paletteColor,
  panelLook,
  progressLook,
  tableFromKit,
  tagLook,
} from "./conceptStarters.js";
import {
  applyColumnStyles,
  type ConceptStyle,
  linkStyle,
} from "./conceptStyle.js";
import { newItemId } from "./proposal.js";
import type {
  ReviewConcept,
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "./reviewConcept.js";

/**
 * Where new concept elements start: each kind's sample content and the look
 * the brand kit gives it before anything is styled. No React, so the server
 * can draw a kit's components too (the docs feed in api/brand-kits).
 */
const brandTypeface = (
  doc: BrandKitDoc | null | undefined,
  roles: string[]
): TypefaceEntry | undefined =>
  doc?.typefaces.find(
    (face) => face.ref && roles.includes(face.role.trim().toLowerCase())
  ) ?? doc?.typefaces.find((face) => face.ref);

/** A card's size is its title's; its body has its own (bodySize). */
const TYPE_SIZES: Partial<Record<ReviewConceptElementKind, number>> = {
  card: 18,
  text: 28,
};

const SURFACE_KINDS = new Set<ReviewConceptElementKind>([
  "upload",
  "panel",
  "input",
  "textarea",
  "select",
  "card",
  "tabs",
  "table",
]);
const PADDED_KINDS = new Set<ReviewConceptElementKind>([
  "tooltip",
  "upload",
  "panel",
  "input",
  "textarea",
  "select",
  "card",
  "badge",
  "tag",
  "tabs",
  "table",
]);
const ROUNDED_KINDS = new Set<ReviewConceptElementKind>([
  "tooltip",
  "upload",
  "panel",
  "button",
  "icon",
  "input",
  "textarea",
  "select",
  "card",
  "badge",
  "tag",
]);

const elementText: Record<ReviewConceptElementKind, string> = {
  badge: "New",
  button: "Get started",
  canvas: "Canvas component",
  card: "Card title\nSupporting copy goes here.",
  checkbox: "I agree to the terms",
  dialog: "Confirm changes?",
  divider: "",
  group: "",
  icon: "",
  input: "",
  label: "Email address",
  link: "Learn more",
  logo: "",
  menu: "Actions",
  navbar: "",
  panel: "Panel title",
  progress: "Upload progress",
  select: "Choose an option",
  skeleton: "",
  table: "Project name",
  tabs: "Overview",
  tag: "Design",
  text: "A better way to work",
  textarea: "",
  toast: "Changes saved",
  tooltip: "Helpful information",
  upload: "Drop a file here, or browse",
};

const elementOptions = (
  kind: ReviewConceptElementKind
): string[] | undefined => {
  if (kind === "menu") {
    return ["Rename", "Duplicate", "Delete"];
  }
  if (kind === "select" || kind === "tabs") {
    return ["Overview", "Settings", "Activity"];
  }
};

const elementPadding = (
  kind: ReviewConceptElementKind
): { paddingX: number; paddingY: number } => {
  if (kind === "button") {
    return { paddingX: 18, paddingY: 11 };
  }
  if (PADDED_KINDS.has(kind)) {
    return { paddingX: 12, paddingY: 8 };
  }
  return { paddingX: 0, paddingY: 0 };
};

const elementState = (
  kind: ReviewConceptElementKind
): Partial<ReviewConceptElement> => {
  switch (kind) {
    case "icon":
      return { iconName: "StarIcon" };
    case "input":
      return { inputType: "email", placeholder: "Enter your email" };
    case "textarea":
      return { placeholder: "Write a message…" };
    case "checkbox":
      return { checked: true };
    default:
      return {};
  }
};

const elementBackground = (
  kind: ReviewConceptElementKind,
  brandDoc?: BrandKitDoc | null
): string => {
  if (kind === "button" || kind === "tooltip") {
    return paletteColor(brandDoc, ["button", "accent", "primary"], "#172033");
  }
  if (SURFACE_KINDS.has(kind)) {
    return paletteColor(brandDoc, ["surface", "background"], "#ffffff");
  }
  return "transparent";
};

const elementWeight = (
  kind: ReviewConceptElementKind
): ReviewConceptElement["fontWeight"] => {
  if (kind === "text") {
    return 700;
  }
  if (kind === "button" || kind === "label" || kind === "badge") {
    return 600;
  }
  if (kind === "tag") {
    return 500;
  }
  return 400;
};

/** The starting look a toast, checkbox or card adds on top of the base. */
const controlLook = (
  kind: ReviewConceptElementKind,
  brandDoc?: BrandKitDoc | null
): Partial<ReviewConceptElement> => {
  if (kind === "toast") {
    return {
      accentColor: paletteColor(
        brandDoc,
        ["accent", "primary", "button"],
        "#3538cd"
      ),
      toastAction: "Undo",
      toastClose: true,
    };
  }
  if (kind === "checkbox") {
    return {
      accentColor: paletteColor(
        brandDoc,
        ["accent", "primary", "button"],
        "#3538cd"
      ),
      checkSize: 18,
    };
  }
  if (kind === "card") {
    return {
      bodySize: 14,
      borderColor: paletteColor(
        brandDoc,
        ["border", "outline", "stroke"],
        "#d0d5dd"
      ),
      shadow: DEFAULT_SHADOW,
    };
  }
  return {};
};

export const createConceptElement = (
  kind: ReviewConceptElementKind,
  brandDoc?: BrandKitDoc | null
): ReviewConceptElement => {
  const face = brandTypeface(
    brandDoc,
    kind === "text" ? ["headline", "heading", "display"] : ["body", "text"]
  );
  const background = elementBackground(kind, brandDoc);
  const weight = elementWeight(kind);
  const { paddingX, paddingY } = elementPadding(kind);
  const options = elementOptions(kind);
  return {
    background,
    color:
      kind === "button" || kind === "tooltip"
        ? paletteColor(brandDoc, ["button ink", "on button"], "#ffffff")
        : paletteColor(brandDoc, ["ink", "text"], "#172033"),
    fontFamily: face?.ref ? "brand" : "sans",
    ...(face?.ref ? { fontRef: face.ref } : {}),
    fontSize: TYPE_SIZES[kind] ?? 14,
    fontWeight: weight,
    id: newItemId(),
    kind,
    lineHeight: 1.25,
    paddingX,
    paddingY,
    radius: ROUNDED_KINDS.has(kind) ? 6 : 0,
    text: elementText[kind],
    ...(options ? { options } : {}),
    ...elementState(kind),
    ...(kind === "table" ? { table: tableFromKit(brandDoc) } : {}),
    ...(kind === "badge" ? badgeLook(brandDoc) : {}),
    ...(kind === "tag" ? tagLook(brandDoc) : {}),
    ...(kind === "progress" ? progressLook(brandDoc) : {}),
    ...(kind === "panel" ? panelLook(brandDoc, createConceptElement) : {}),
    ...(kind === "navbar" ? navbarLook(brandDoc, createConceptElement) : {}),
    ...(kind === "logo" ? logoLook(brandDoc) : {}),
    ...controlLook(kind, brandDoc),
    // A group is layout, not a surface: clear, and empty to fill.
    ...(kind === "group"
      ? {
          background: "transparent",
          group: { align: "center", elements: [], gap: 8, layout: "row" },
          paddingX: 0,
          paddingY: 0,
          radius: 0,
        }
      : {}),
  };
};

export const createConcept = (brandDoc?: BrandKitDoc | null): ReviewConcept => {
  const face = brandTypeface(brandDoc, ["headline", "heading", "display"]);
  return {
    align: "start",
    background: paletteColor(
      brandDoc,
      ["surface", "background"],
      brandDoc?.palette[0]?.value ?? "#f2f4f7"
    ),
    color: paletteColor(brandDoc, ["ink", "text"], "#172033"),
    direction: "column",
    elements: [
      createConceptElement("text", brandDoc),
      createConceptElement("button", brandDoc),
    ],
    fontFamily: face?.ref ? "brand" : "sans",
    ...(face?.ref ? { fontRef: face.ref } : {}),
    gap: 12,
    id: newItemId(),
    padding: 24,
    radius: 12,
    title: "Homepage hero",
  };
};

/**
 * What a style is drawn on: its kind's sample content, in the style's look.
 * Exactly as a concept linked to it draws — no stand-in content of its own,
 * so the kit, the guide and every review show the same thing.
 */
export const styleSample = (
  style: ConceptStyle,
  brand: BrandKitDoc
): ReviewConceptElement => {
  const linked = linkStyle(
    { ...createConceptElement(style.kind, brand), id: style.id },
    style
  );
  if (linked.table) {
    return applyColumnStyles(
      { ...linked, table: { ...linked.table, ...style.look.tableContents } },
      brand.componentStyles
    );
  }
  // The kit's own starting items, as they were set, ids and all.
  return style.look.contents
    ? { ...linked, slots: style.look.contents }
    : linked;
};
