import type { SiteScan } from "./siteScan.js";

/**
 * A brand's type and spacing scale: the named text styles (display, h1…,
 * body, small) with size, weight, line height, tracking and case, each set in
 * the kit's headline or body face, plus the spacing steps layouts keep to.
 *
 * Stored on the kit (BrandKitDoc.typeScale), edited on the kit page and in the
 * board Studio, and written into DESIGN.md as its typography and spacing
 * tokens. Sizes are pixels; tracking is em.
 */

export const CASES = ["none", "uppercase", "lowercase", "capitalize"] as const;
export type TextCase = (typeof CASES)[number];

export interface TypeStyle {
  case: TextCase;
  /** Which of the kit's faces sets it. */
  face: "body" | "headline";
  lineHeight: number;
  /** Token name: lower-case, digits and dashes. */
  name: string;
  size: number;
  tracking: number;
  weight: number;
}

export interface TypeScale {
  /** Pixels, small to large. */
  spacing: number[];
  styles: TypeStyle[];
}

export const MAX_STYLES = 16;
export const MAX_SPACING = 12;

export const RATIOS = [
  { label: "Minor second 1.067", value: 1.067 },
  { label: "Major second 1.125", value: 1.125 },
  { label: "Minor third 1.2", value: 1.2 },
  { label: "Major third 1.25", value: 1.25 },
  { label: "Perfect fourth 1.333", value: 1.333 },
  { label: "Augmented fourth 1.414", value: Math.SQRT2 },
  { label: "Perfect fifth 1.5", value: 1.5 },
  { label: "Golden ratio 1.618", value: 1.618 },
] as const;

const NAME = /[^a-z0-9-]+/g;
const EDGES = /^-+|-+$/g;

export const styleName = (value: unknown): string =>
  typeof value === "string"
    ? value
        .toLowerCase()
        .trim()
        .replace(NAME, "-")
        .replace(EDGES, "")
        .slice(0, 24)
    : "";

const num = (value: unknown, min: number, max: number, fallback: number) => {
  const n =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Rounded to a step, without floating-point tails (1.4, not 1.4000000001). */
const round = (n: number, to: number) =>
  Number((Math.round(n / to) * to).toFixed(4));

export const sanitizeTypeScale = (value: unknown): TypeScale | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const seen = new Set<string>();
  const styles = (Array.isArray(raw.styles) ? raw.styles : [])
    .map((entry): TypeStyle | null => {
      const e = (entry ?? {}) as Record<string, unknown>;
      const name = styleName(e.name);
      if (!name || seen.has(name)) {
        return null;
      }
      seen.add(name);
      return {
        case: CASES.includes(e.case as TextCase)
          ? (e.case as TextCase)
          : "none",
        face: e.face === "headline" ? "headline" : "body",
        lineHeight: round(num(e.lineHeight, 0.7, 3, 1.4), 0.01),
        name,
        size: round(num(e.size, 6, 400, 16), 0.5),
        tracking: round(num(e.tracking, -0.2, 0.5, 0), 0.001),
        weight: round(num(e.weight, 100, 1000, 400), 1),
      };
    })
    .filter((s): s is TypeStyle => s !== null)
    .slice(0, MAX_STYLES);
  const spacing = [
    ...new Set(
      (Array.isArray(raw.spacing) ? raw.spacing : [])
        .map((v) => round(num(v, 0, 512, Number.NaN), 0.5))
        .filter((v) => Number.isFinite(v) && v > 0)
    ),
  ]
    .sort((a, b) => a - b)
    .slice(0, MAX_SPACING);
  return styles.length > 0 || spacing.length > 0 ? { spacing, styles } : null;
};

/** Steps up (+) or down (−) the ratio from the body size, per style. */
const LADDER: {
  case?: TextCase;
  face: TypeStyle["face"];
  name: string;
  step: number;
  tracking: number;
  weight?: number;
}[] = [
  { face: "headline", name: "display", step: 6, tracking: -0.025 },
  { face: "headline", name: "h1", step: 5, tracking: -0.02 },
  { face: "headline", name: "h2", step: 4, tracking: -0.015 },
  { face: "headline", name: "h3", step: 3, tracking: -0.01 },
  { face: "headline", name: "h4", step: 2, tracking: 0 },
  { face: "body", name: "lead", step: 1, tracking: 0, weight: 400 },
  { face: "body", name: "body", step: 0, tracking: 0, weight: 400 },
  { face: "body", name: "small", step: -1, tracking: 0.005, weight: 400 },
  {
    case: "uppercase",
    face: "body",
    name: "label",
    step: -1,
    tracking: 0.08,
    weight: 600,
  },
];

/** Tighter leading as type gets larger: 1.6 at 14px down to 1.05 by 60px. */
export const leadingFor = (size: number) =>
  round(Math.min(1.6, Math.max(1.05, 1.6 - (size - 14) * 0.012)), 0.05);

export const modularScale = ({
  base,
  headWeight,
  ratio,
}: {
  base: number;
  headWeight: number;
  ratio: number;
}): TypeStyle[] =>
  LADDER.map((s) => {
    const size = round(base * ratio ** s.step, 1);
    return {
      case: s.case ?? "none",
      face: s.face,
      lineHeight: leadingFor(size),
      name: s.name,
      size,
      tracking: s.tracking,
      weight: s.weight ?? headWeight,
    };
  });

/** Spacing on a base unit: half, one, one and a half, two… sixteen. */
export const spacingSteps = (unit: number): number[] =>
  [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16].map((m) => round(unit * m, 0.5));

const px = (v: string | undefined) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) ? n : null;
};

/** The scale a website already uses, from a scan (config/siteScan.ts). */
export const fromScan = (scan: SiteScan): TypeScale => {
  const styles = scan.typography.flatMap((t): TypeStyle[] => {
    const size = px(t.style.fontSize);
    if (!size) {
      return [];
    }
    const transform = t.style.textTransform as TextCase | undefined;
    return [
      {
        case: transform && CASES.includes(transform) ? transform : "none",
        face: t.name.startsWith("h") ? "headline" : "body",
        lineHeight: px(t.style.lineHeight) ?? leadingFor(size),
        name: styleName(t.name),
        size,
        tracking: px(t.style.letterSpacing) ?? 0,
        weight: px(t.style.fontWeight) ?? 400,
      },
    ];
  });
  return (
    sanitizeTypeScale({
      spacing: scan.spacing.map((s) => px(s)),
      styles,
    }) ?? { spacing: [], styles: [] }
  );
};

/** The CSS for one style, for previews and copying. */
export const styleCss = (s: TypeStyle) => ({
  fontSize: `${s.size}px`,
  fontWeight: s.weight,
  letterSpacing: s.tracking ? `${s.tracking}em` : undefined,
  lineHeight: s.lineHeight,
  textTransform: s.case === "none" ? undefined : s.case,
});

/** Custom properties for the whole scale. */
export const scaleCss = (scale: TypeScale): string => {
  const lines = scale.styles.flatMap((s) => [
    `  --text-${s.name}: ${s.size / 16}rem;`,
    `  --text-${s.name}--line-height: ${s.lineHeight};`,
    `  --text-${s.name}--font-weight: ${s.weight};`,
    ...(s.tracking
      ? [`  --text-${s.name}--letter-spacing: ${s.tracking}em;`]
      : []),
  ]);
  const space = scale.spacing.map(
    (v, i) => `  --space-${i + 1}: ${v / 16}rem;`
  );
  return `:root {\n${[...lines, ...space].join("\n")}\n}\n`;
};
