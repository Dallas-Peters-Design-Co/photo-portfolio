import { isConceptPaint } from "./conceptColor.js";
/**
 * A concept card's drop shadow: one CSS box-shadow, edited field by field.
 *
 * Cards first stored a preset name ("none" | "soft" | "strong"); those are
 * read as the matching values, so older reviews keep their look.
 */
export interface ConceptShadow {
  blur: number;
  color: string;
  /** Keep explicit Custom selection even when its values match a preset. */
  custom?: true;
  /** 0–100, how much of `color` shows. 0 is no shadow. */
  opacity: number;
  spread: number;
  x: number;
  y: number;
}

export const SHADOW_PRESETS = {
  none: { blur: 0, color: "#000000", opacity: 0, spread: 0, x: 0, y: 0 },
  soft: { blur: 14, color: "#000000", opacity: 14, spread: 0, x: 0, y: 4 },
  strong: { blur: 36, color: "#000000", opacity: 35, spread: 0, x: 0, y: 14 },
} satisfies Record<string, ConceptShadow>;

export type ShadowPreset = keyof typeof SHADOW_PRESETS;

/** What a card without a stored shadow draws. */
export const DEFAULT_SHADOW: ConceptShadow = SHADOW_PRESETS.soft;

/** An element's shadow: its own, else a card's soft one, else none. */
export const shadowOf = (element: {
  kind: string;
  shadow?: ConceptShadow;
}): ConceptShadow =>
  element.shadow ??
  (element.kind === "card" ? DEFAULT_SHADOW : SHADOW_PRESETS.none);

/** The editable ranges, shared by the cleaner and the form. */
export const SHADOW_LIMITS = {
  blur: [0, 128],
  opacity: [0, 100],
  spread: [-32, 64],
  x: [-64, 64],
  y: [-64, 64],
} as const satisfies Record<
  Exclude<keyof ConceptShadow, "color" | "custom">,
  readonly [number, number]
>;

const clamp = (value: unknown, [min, max]: readonly [number, number]) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : 0;

export const cleanShadow = (value: unknown): ConceptShadow | undefined => {
  if (typeof value === "string") {
    return value in SHADOW_PRESETS
      ? SHADOW_PRESETS[value as ShadowPreset]
      : undefined;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Partial<ConceptShadow>;
  return {
    ...(raw.custom === true ? { custom: true } : {}),
    blur: clamp(raw.blur, SHADOW_LIMITS.blur),
    color:
      typeof raw.color === "string" && isConceptPaint(raw.color)
        ? raw.color
        : "#000000",
    opacity: clamp(raw.opacity, SHADOW_LIMITS.opacity),
    spread: clamp(raw.spread, SHADOW_LIMITS.spread),
    x: clamp(raw.x, SHADOW_LIMITS.x),
    y: clamp(raw.y, SHADOW_LIMITS.y),
  };
};

/** The preset a shadow matches exactly, or null when it has been tuned. */
export const presetOf = (shadow: ConceptShadow): ShadowPreset | null => {
  if (shadow.custom) {
    return null;
  }
  return (
    (Object.keys(SHADOW_PRESETS) as ShadowPreset[]).find((name) =>
      (
        Object.keys(
          SHADOW_PRESETS[name]
        ) as (keyof typeof SHADOW_PRESETS.none)[]
      ).every((key) => SHADOW_PRESETS[name][key] === shadow[key])
    ) ?? null
  );
};

export const shadowCss = (shadow: ConceptShadow = DEFAULT_SHADOW): string =>
  shadow.opacity === 0
    ? "none"
    : `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px color-mix(in srgb, ${shadow.color} ${shadow.opacity}%, transparent)`;
