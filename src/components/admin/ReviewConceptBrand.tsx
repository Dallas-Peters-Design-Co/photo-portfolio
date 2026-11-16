import type { BrandKitDoc, TypefaceEntry } from "../../../config/brandKit.js";
import { DEFAULT_SHADOW } from "../../../config/conceptShadow.js";
import { type ConceptStyle, linkStyle } from "../../../config/conceptStyle.js";
import { newItemId } from "../../../config/proposal.js";
import {
  ELEMENT_STYLE_KEYS,
  type ReviewConcept,
  type ReviewConceptElement,
  type ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";
import { ColorWell } from "../../boards/ColorWell";
import { ConceptSelect } from "./ConceptControls";
import {
  badgeLook,
  paletteColor,
  panelLook,
  progressLook,
  tableFromKit,
  tagLook,
} from "./conceptStarters";

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
  "panel",
  "input",
  "textarea",
  "select",
  "card",
  "tabs",
  "table",
]);
const PADDED_KINDS = new Set<ReviewConceptElementKind>([
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
  card: "Card title\nSupporting copy goes here.",
  checkbox: "I agree to the terms",
  dialog: "Confirm changes?",
  divider: "",
  icon: "",
  input: "",
  label: "Email address",
  link: "Learn more",
  menu: "Actions",
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
  if (kind === "button") {
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
      kind === "button"
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
    ...controlLook(kind, brandDoc),
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

export const conceptFontSelection = (
  family: string,
  fontRef?: string,
  fontId?: string
): string => {
  if (family === "brand" && fontRef) {
    return `brand|${fontRef}`;
  }
  if (family === "app" && fontId) {
    return `app|${fontId}`;
  }
  return family;
};

export const conceptFontPatch = (
  value: string
): Pick<ReviewConcept, "fontFamily" | "fontRef" | "fontId"> => {
  if (value.startsWith("brand|")) {
    return {
      fontFamily: "brand",
      fontId: undefined,
      fontRef: value.slice("brand|".length),
    };
  }
  if (value.startsWith("app|")) {
    return {
      fontFamily: "app",
      fontId: value.slice("app|".length),
      fontRef: undefined,
    };
  }
  return {
    fontFamily: value as ReviewConcept["fontFamily"],
    fontId: undefined,
    fontRef: undefined,
  };
};

const NONE = "transparent";

/**
 * A colour from the brand palette or the swatch. With `allowNone`, "None"
 * clears it (stored as "transparent"): no fill, no border.
 */
export function ConceptColorField({
  allowNone = false,
  ariaLabel,
  brandDoc,
  label,
  onChange,
  value,
}: {
  allowNone?: boolean;
  ariaLabel: string;
  brandDoc?: BrandKitDoc | null;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const palette = (brandDoc?.palette ?? []).filter(
    (entry, index, all) =>
      all.findIndex((other) => other.value === entry.value) === index
  );
  const options = [
    ...(allowNone ? [{ label: "None", value: NONE }] : []),
    ...palette.map((entry) => ({
      label:
        [entry.role, entry.name].filter(Boolean).join(" · ") || entry.value,
      value: entry.value,
    })),
  ];
  const listed = options.some((option) => option.value === value);
  return (
    <div className="review-concepts__field review-concepts__field--color">
      <span>{label}</span>
      <div className="review-concepts__color-row">
        {options.length > 0 ? (
          <div className="review-concepts__color-pick">
            <ConceptSelect
              label={`${ariaLabel} brand color`}
              onChange={onChange}
              options={options}
              placeholder="Custom color"
              value={listed ? value : ""}
            />
          </div>
        ) : null}
        <ColorWell label={ariaLabel} noVars onChange={onChange} value={value} />
      </div>
    </div>
  );
}

/**
 * A new element takes the look of the last one of its kind, so a second
 * button matches the first without restyling it. Content stays the default.
 */
export const addConceptElement = (
  elements: ReviewConceptElement[],
  kind: ReviewConceptElementKind,
  brandDoc?: BrandKitDoc | null
): ReviewConceptElement[] => {
  const fresh = createConceptElement(kind, brandDoc);
  const model = elements.filter((element) => element.kind === kind).at(-1);
  if (!model) {
    return [...elements, fresh];
  }
  const isStyle = (key: string) =>
    (ELEMENT_STYLE_KEYS as readonly string[]).includes(key);
  const content = Object.entries(fresh).filter(([key]) => !isStyle(key));
  const style = Object.entries(model).filter(([key]) => isStyle(key));
  return [
    ...elements,
    Object.fromEntries([...content, ...style]) as ReviewConceptElement,
  ];
};

/** An exact copy, placed right after the original. */
export const duplicateConceptElement = (
  elements: ReviewConceptElement[],
  id: string
): ReviewConceptElement[] =>
  elements.flatMap((element) =>
    element.id === id ? [element, { ...element, id: newItemId() }] : [element]
  );

/**
 * What a style is drawn on: its kind's sample content, in the style's look.
 * Exactly as a concept linked to it draws — no stand-in content of its own,
 * so the kit, the guide and every review show the same thing.
 */
export const styleSample = (
  style: ConceptStyle,
  brand: BrandKitDoc
): ReviewConceptElement =>
  linkStyle(
    { ...createConceptElement(style.kind, brand), id: style.id },
    style
  );
