import type { TypeScale, TypeStyle } from "./typeScale.js";

/**
 * The parts of a DESIGN.md that come from the kit's own type and spacing
 * scale (config/typeScale.ts). A kit with a scale states its type and spacing
 * outright, so these take the place of the sizes read off its website.
 */

const SPACE_NAMES = [
  "2xs",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
];

const quote = (v: string) => JSON.stringify(v);

/** The `typography:` token lines, one block per style. */
export const scaleTypographyLines = (
  scale: TypeScale,
  familyFor: (face: TypeStyle["face"]) => string | undefined
): string[] =>
  scale.styles.flatMap((s) => {
    const family = familyFor(s.face);
    return [
      `  ${s.name}:`,
      ...(family ? [`    fontFamily: ${quote(family)}`] : []),
      `    fontSize: ${s.size}px`,
      `    fontWeight: ${s.weight}`,
      `    lineHeight: ${s.lineHeight}`,
      ...(s.tracking ? [`    letterSpacing: ${s.tracking}em`] : []),
    ];
  });

export const scaleSpacing = (scale: TypeScale): [string, string][] =>
  scale.spacing.map((v, i) => [SPACE_NAMES[i] ?? `s${i + 1}`, `${v}px`]);

/** One line per style, for the Typography section. */
export const scaleProse = (scale: TypeScale): string[] =>
  scale.styles.length === 0
    ? []
    : [
        "",
        "The type scale. Use these styles rather than setting sizes by hand:",
        "",
        ...scale.styles.map((s) => {
          const extra = [
            s.tracking ? `tracking ${s.tracking}em` : "",
            s.case === "none" ? "" : s.case,
          ].filter(Boolean);
          return `- **${s.name}** (\`{typography.${s.name}}\`): ${s.size}px / ${s.lineHeight}, weight ${s.weight}, ${s.face} face${extra.length > 0 ? `, ${extra.join(", ")}` : ""}`;
        }),
      ];

export const scaleLayout = (scale: TypeScale): string[] =>
  scale.spacing.length === 0
    ? []
    : [
        "## Layout",
        "",
        `Spacing steps: ${scaleSpacing(scale)
          .map(([k, v]) => `${k} ${v}`)
          .join(", ")}. Keep margins, padding and gaps to these.`,
      ];
