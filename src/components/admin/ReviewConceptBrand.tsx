import type { BrandKitDoc, TypefaceEntry } from "../../../config/brandKit.js";
import { fontRefStack, parseFontRef } from "../../../config/fontRef.js";
import { newItemId } from "../../../config/proposal.js";
import type {
  ReviewConcept,
  ReviewConceptElement,
  ReviewConceptElementKind,
} from "../../../config/review.js";

const FONT_FAMILIES = {
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: "var(--font-sans, Arial, sans-serif)",
  serif: "Georgia, serif",
} as const;

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

export const createConceptElement = (
  kind: ReviewConceptElementKind,
  brandDoc?: BrandKitDoc | null
): ReviewConceptElement => {
  const face = brandTypeface(
    brandDoc,
    kind === "text" ? ["headline", "heading", "display"] : ["body", "text"]
  );
  return {
    background:
      kind === "button"
        ? paletteColor(brandDoc, ["button", "accent", "primary"], "#172033")
        : "transparent",
    color:
      kind === "button"
        ? paletteColor(brandDoc, ["button ink", "on button"], "#ffffff")
        : paletteColor(brandDoc, ["ink", "text"], "#172033"),
    fontFamily: face?.ref ? "brand" : "sans",
    ...(face?.ref ? { fontRef: face.ref } : {}),
    fontSize: kind === "button" ? 14 : 28,
    fontWeight: kind === "button" ? 600 : 700,
    id: newItemId(),
    kind,
    lineHeight: 1.25,
    paddingX: kind === "button" ? 18 : 0,
    paddingY: kind === "button" ? 11 : 0,
    radius: kind === "button" ? 6 : 0,
    text: kind === "button" ? "Get started" : "A better way to work",
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

export const conceptFamilyCss = (family: string, fontRef?: string): string => {
  const ref = fontRef ? parseFontRef(fontRef) : null;
  if (family === "brand" && ref) {
    return fontRefStack(ref);
  }
  return (
    FONT_FAMILIES[family as keyof typeof FONT_FAMILIES] ?? FONT_FAMILIES.sans
  );
};

export const conceptFontSelection = (
  family: string,
  fontRef?: string
): string => (family === "brand" && fontRef ? `brand|${fontRef}` : family);

export const conceptFontPatch = (
  value: string
): Pick<ReviewConcept, "fontFamily" | "fontRef"> =>
  value.startsWith("brand|")
    ? { fontFamily: "brand", fontRef: value.slice("brand|".length) }
    : { fontFamily: value as ReviewConcept["fontFamily"], fontRef: undefined };

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
