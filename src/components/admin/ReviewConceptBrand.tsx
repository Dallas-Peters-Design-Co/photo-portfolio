import type { BrandKitDoc, TypefaceEntry } from "../../../config/brandKit.js";
import { newItemId } from "../../../config/proposal.js";
import type {
  ReviewConcept,
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "../../../config/reviewConcept.js";

const paletteColor = (
  doc: BrandKitDoc | null | undefined,
  roles: string[],
  fallback: string
): string =>
  doc?.palette.find((entry) => roles.includes(entry.role.trim().toLowerCase()))
    ?.value ?? fallback;

const brandTypeface = (
  doc: BrandKitDoc | null | undefined,
  roles: string[]
): TypefaceEntry | undefined =>
  doc?.typefaces.find(
    (face) => face.ref && roles.includes(face.role.trim().toLowerCase())
  ) ?? doc?.typefaces.find((face) => face.ref);

const SURFACE_KINDS = new Set<ReviewConceptElementKind>([
  "input",
  "textarea",
  "select",
  "card",
  "tabs",
  "table",
]);
const PADDED_KINDS = new Set<ReviewConceptElementKind>([
  "input",
  "textarea",
  "select",
  "card",
  "badge",
  "tabs",
  "table",
]);
const ROUNDED_KINDS = new Set<ReviewConceptElementKind>([
  "button",
  "icon",
  "input",
  "textarea",
  "select",
  "card",
  "badge",
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
  select: "Choose an option",
  skeleton: "",
  table: "Project name",
  tabs: "Overview",
  text: "A better way to work",
  textarea: "",
  toast: "Changes saved",
};

const elementOptions = (
  kind: ReviewConceptElementKind
): string[] | undefined => {
  if (kind === "table") {
    return ["Project", "Status"];
  }
  if (kind === "menu") {
    return ["Rename", "Duplicate", "Delete"];
  }
  if (kind === "select" || kind === "tabs") {
    return ["Overview", "Settings", "Activity"];
  }
};

const elementState = (
  kind: ReviewConceptElementKind
): Partial<ReviewConceptElement> => {
  switch (kind) {
    case "icon":
      return { iconName: "star" };
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

export const createConceptElement = (
  kind: ReviewConceptElementKind,
  brandDoc?: BrandKitDoc | null
): ReviewConceptElement => {
  const isButton = kind === "button";
  const isText = kind === "text";
  const isPadded = PADDED_KINDS.has(kind);
  const face = brandTypeface(
    brandDoc,
    isText ? ["headline", "heading", "display"] : ["body", "text"]
  );
  let background = "transparent";
  if (isButton) {
    background = paletteColor(
      brandDoc,
      ["button", "accent", "primary"],
      "#172033"
    );
  } else if (SURFACE_KINDS.has(kind)) {
    background = paletteColor(brandDoc, ["surface", "background"], "#ffffff");
  }
  let weight: ReviewConceptElement["fontWeight"] = 400;
  if (isText) {
    weight = 700;
  } else if (isButton || kind === "label" || kind === "badge") {
    weight = 600;
  }
  let paddingX = 0;
  let paddingY = 0;
  if (isButton) {
    paddingX = 18;
    paddingY = 11;
  } else if (isPadded) {
    paddingX = 12;
    paddingY = 8;
  }
  const options = elementOptions(kind);
  return {
    background,
    color:
      kind === "button"
        ? paletteColor(brandDoc, ["button ink", "on button"], "#ffffff")
        : paletteColor(brandDoc, ["ink", "text"], "#172033"),
    fontFamily: face?.ref ? "brand" : "sans",
    ...(face?.ref ? { fontRef: face.ref } : {}),
    fontSize: isText ? 28 : 14,
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

export function ConceptColorField({
  ariaLabel,
  brandDoc,
  label,
  onChange,
  value,
}: {
  ariaLabel: string;
  brandDoc?: BrandKitDoc | null;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const palette = brandDoc?.palette ?? [];
  return (
    <label className="review-concepts__field review-concepts__field--color">
      <span>{label}</span>
      {palette.length > 0 ? (
        <select
          aria-label={`${ariaLabel} brand color`}
          onChange={(event) => {
            if (event.target.value) {
              onChange(event.target.value);
            }
          }}
          value={palette.some((entry) => entry.value === value) ? value : ""}
        >
          <option value="">Custom color</option>
          {palette.map((entry) => (
            <option
              key={`${entry.value}-${entry.name}-${entry.role}`}
              value={entry.value}
            >
              {[entry.role, entry.name].filter(Boolean).join(" · ") ||
                entry.value}
            </option>
          ))}
        </select>
      ) : null}
      <input
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        type="color"
        value={value === "transparent" ? "#ffffff" : value}
      />
    </label>
  );
}
