import type { BrandKitDoc, PaletteEntry, TypefaceEntry } from "./brandKit.js";
import {
  scaleLayout,
  scaleProse,
  scaleSpacing,
  scaleTypographyLines,
} from "./designMdScale.js";
import {
  layoutSection,
  scannedComponentLines,
  scanTokens,
  shapesSection,
} from "./designMdScan.js";
import { parseFontRef } from "./fontRef.js";

/**
 * A brand kit as a DESIGN.md: the open format (google-labs-code/design.md)
 * that tells coding and design agents how a brand looks. Tokens go in the YAML
 * front matter (colours, type, the primary button); the prose sections carry
 * what tokens can't: the voice, how the logo is used, what imagery is and
 * isn't on brand, and the decisions and feedback in the kit's references.
 *
 * Deterministic on purpose: the same kit always writes the same file, so the
 * vault sync only rewrites a note when the brand actually changed.
 */

export interface DesignMdKit {
  doc: BrandKitDoc;
  name: string;
  parentName?: string | null;
  version?: number | null;
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");

/** Unique token names, from each entry's role, else its name, else a number. */
const tokenNames = <T>(
  entries: T[],
  label: (entry: T) => string,
  fallback: string
): string[] => {
  const used = new Map<string, number>();
  return entries.map((entry, i) => {
    const base = slug(label(entry)) || `${fallback}-${i + 1}`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
};

const PLAIN = /^[\w .,-]+$/;
const RESERVED = /^(true|false|null|yes|no|[\d.]+)$/i;

/** YAML scalar: quoted when it could be read as anything but a string. */
const yamlString = (s: string): string =>
  PLAIN.test(s) && !RESERVED.test(s) ? s : JSON.stringify(s);

const luminance = (hex: string): number => {
  const n = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * n(1) + 0.7152 * n(3) + 0.0722 * n(5);
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

const saturation = (hex: string): number => {
  const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return (Math.max(...c) - Math.min(...c)) / 255;
};

const NEUTRAL =
  /neutral|grey|gray|surface|background|bg|paper|ink|text|base|border|line/i;
const SIGNAL = /success|warning|error|danger|alert|info|status/i;
const HEADLINE_ROLE = /headline|heading/i;
const HEAD_ROLE = /head|display|title/i;
const BODY_ROLE = /body|text|copy|paragraph/i;

const isNeutral = (p: PaletteEntry) =>
  NEUTRAL.test(`${p.role} ${p.name}`) || saturation(p.value) < 0.08;

/** The brand's main colour: the first that is neither neutral nor a signal. */
const accentOf = (palette: PaletteEntry[]) =>
  palette.find((p) => !(isNeutral(p) || SIGNAL.test(`${p.role} ${p.name}`)));

export const facesOf = (faces: TypefaceEntry[]) => {
  const head =
    faces.find((f) => HEADLINE_ROLE.test(f.role)) ??
    faces.find((f) => HEAD_ROLE.test(f.role));
  const body = faces.find((f) => BODY_ROLE.test(f.role));
  const headline = head ?? faces[0];
  return {
    body: body ?? faces.find((f) => f !== headline) ?? headline,
    headline,
  };
};

const sourceOf = (face: TypefaceEntry): string => {
  const ref = parseFontRef(face.ref);
  if (ref?.source === "google") {
    return `[Google Fonts](https://fonts.google.com/specimen/${encodeURIComponent(ref.family).replace(/%20/g, "+")})`;
  }
  if (ref?.source === "adobe") {
    return `Adobe Fonts (web project \`${ref.kitId}\`)`;
  }
  return "a licensed or local font";
};

export const familyOf = (face: TypefaceEntry) =>
  parseFontRef(face.ref)?.family ?? face.name;

/**
 * Token names for the palette: the main brand colour is `primary`, the spec's
 * name for it, and the rest go by their role or name.
 */
const colorTokenNames = (palette: PaletteEntry[]): string[] => {
  const accent = accentOf(palette);
  const named = tokenNames(palette, (p) => p.role || p.name, "color");
  if (!accent || named.includes("primary")) {
    return named;
  }
  return named.map((n, i) => (palette[i] === accent ? "primary" : n));
};

/** The palette colour that reads best on `bg`, else black or white. */
const textOn = (
  bg: PaletteEntry,
  palette: PaletteEntry[],
  names: string[]
): string => {
  const [best] = palette
    .filter((p) => p !== bg)
    .sort((a, b) => contrast(b.value, bg.value) - contrast(a.value, bg.value));
  if (best && contrast(best.value, bg.value) >= 4.5) {
    return `"{colors.${names[palette.indexOf(best)]}}"`;
  }
  return contrast("#ffffff", bg.value) >= contrast("#000000", bg.value)
    ? '"#ffffff"'
    : '"#000000"';
};

interface Tokens {
  colorNames: string[];
  lines: string[];
}

/** The kit's headline and body faces, sized from the website when scanned,
 * then the website's own extra steps (h1, h2, small…). */
const typographyLines = (
  doc: BrandKitDoc,
  scan: BrandKitDoc["scans"][number] | undefined,
  extra: string[]
): string[] => {
  const lines: string[] = [];
  const { body, headline } = facesOf(doc.typefaces);
  if (doc.typeScale && doc.typeScale.styles.length > 0) {
    // The kit's own scale states every size; the website's aren't needed.
    const face = (which: "body" | "headline") => {
      const f = which === "headline" ? headline : body;
      return f ? familyOf(f) : undefined;
    };
    return ["typography:", ...scaleTypographyLines(doc.typeScale, face)];
  }
  if (headline || extra.length > 0) {
    lines.push("typography:");
  }
  if (headline) {
    lines.push("  headline:");
    lines.push(`    fontFamily: ${yamlString(familyOf(headline))}`);
    lines.push(
      `    fontWeight: ${headline.weights.length > 0 ? Math.max(...headline.weights) : 700}`
    );
    // Sizes from the website when it was scanned; the faces are the kit's.
    const h1 = scan?.typography.find((t) => t.name === "h1")?.style;
    if (h1?.fontSize) {
      lines.push(`    fontSize: ${h1.fontSize}`);
    }
    lines.push(`    lineHeight: ${h1?.lineHeight ?? "1.05"}`);
    if (body) {
      const site = scan?.typography.find((t) => t.name === "body")?.style;
      lines.push("  body:");
      lines.push(`    fontFamily: ${yamlString(familyOf(body))}`);
      if (site?.fontSize) {
        lines.push(`    fontSize: ${site.fontSize}`);
      }
      lines.push("    fontWeight: 400");
      lines.push(`    lineHeight: ${site?.lineHeight ?? "1.5"}`);
    }
  }
  lines.push(...extra);
  return lines;
};

const frontMatter = (kit: DesignMdKit): Tokens => {
  const { doc } = kit;
  const colorNames = colorTokenNames(doc.palette);
  const lines = [
    "---",
    "version: alpha",
    `name: ${yamlString(kit.name)}`,
    `description: ${yamlString(
      `Generated from the ${kit.name} brand kit${kit.version ? ` (version ${kit.version})` : ""}. Edit the kit, not this file.`
    )}`,
  ];
  const [scan] = doc.scans;
  const scanned = scanTokens(
    scan,
    doc.palette.map((p, i) => ({ token: colorNames[i] ?? "", value: p.value })),
    new Set(["headline", "body"])
  );
  // What the kit (and its website scan) doesn't have is said to be left out,
  // rather than leaving an agent to wonder whether it was forgotten.
  const spacing =
    doc.typeScale && doc.typeScale.spacing.length > 0
      ? scaleSpacing(doc.typeScale).map(([k, v]) => `  ${k}: ${v}`)
      : scanned.spacing;
  const omitted = [
    spacing.length === 0 ? "spacing" : "",
    scanned.rounded.length === 0 ? "rounded" : "",
  ].filter(Boolean);
  if (omitted.length > 0) {
    lines.push("omitted:", ...omitted.map((o) => `  - ${o}`));
  }
  if (doc.palette.length > 0) {
    lines.push("colors:");
    doc.palette.forEach((p, i) => {
      lines.push(`  ${colorNames[i]}: "${p.value}"`);
    });
  }
  const typeLines = typographyLines(doc, scan, scanned.typography);
  const hasBody = typeLines.includes("  body:");
  lines.push(...typeLines);
  if (scanned.rounded.length > 0) {
    lines.push("rounded:", ...scanned.rounded);
  }
  if (spacing.length > 0) {
    lines.push("spacing:", ...spacing);
  }
  if (doc.palette.length > 0 || scanned.components.length > 0) {
    lines.push("components:");
    lines.push(...scanned.components);
    const accent = accentOf(doc.palette);
    doc.palette.forEach((p, i) => {
      const token = colorNames[i] ?? "";
      const isButton = p === accent && !scanned.hasPrimaryButton;
      // A colour a scanned component already uses needs no block of its own.
      if (!isButton && scanned.used.has(token)) {
        return;
      }
      // The main colour is the primary button (unless the site supplied one);
      // every other colour is a colour block, with the brand colour that
      // reads best on it as text.
      lines.push(isButton ? "  button-primary:" : `  block-${token}:`);
      lines.push(`    backgroundColor: "{colors.${token}}"`);
      lines.push(`    textColor: ${textOn(p, doc.palette, colorNames)}`);
      if (hasBody && isButton) {
        lines.push(`    typography: "{typography.body}"`);
      }
    });
  }
  lines.push("---");
  return { colorNames, lines };
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

const overview = (kit: DesignMdKit): string[] => {
  const out = ["## Overview", ""];
  if (kit.parentName) {
    out.push(`A sub-brand of ${kit.parentName}.`, "");
  }
  out.push(
    kit.doc.voice.trim() ||
      "The kit doesn't describe its voice yet. Keep copy plain and confident."
  );
  return out;
};

const colors = (doc: BrandKitDoc, names: string[]): string[] => {
  if (doc.palette.length === 0) {
    return [];
  }
  const accent = accentOf(doc.palette);
  return [
    "## Colors",
    "",
    ...doc.palette.map((p, i) => {
      const what = [p.role, p === accent ? "the main brand colour" : ""]
        .filter(Boolean)
        .join(", ");
      return `- **${p.name || names[i]}** \`${p.value}\` (\`{colors.${names[i]}}\`)${what ? `: ${what}` : ""}`;
    }),
  ];
};

const useOf = (
  face: TypefaceEntry,
  headline: TypefaceEntry | undefined,
  body: TypefaceEntry | undefined
): string => {
  if (face === headline) {
    return "headlines";
  }
  if (face === body) {
    return "body copy";
  }
  return face.role || "secondary";
};

const typography = (doc: BrandKitDoc): string[] => {
  if (doc.typefaces.length === 0) {
    return doc.typeScale ? ["## Typography", ...scaleProse(doc.typeScale)] : [];
  }
  const { body, headline } = facesOf(doc.typefaces);
  return [
    "## Typography",
    "",
    ...doc.typefaces.map((face) => {
      const use = useOf(face, headline, body);
      const weights =
        face.weights.length > 0 ? `, weights ${face.weights.join(", ")}` : "";
      const css =
        familyOf(face) === face.name ? "" : ` (CSS \`${familyOf(face)}\`)`;
      return `- **${face.name}**${css} for ${use}, from ${sourceOf(face)}${weights}`;
    }),
    ...(doc.typeScale ? scaleProse(doc.typeScale) : []),
  ];
};

const components = (doc: BrandKitDoc): string[] => {
  const fromSites = scannedComponentLines(doc.scans);
  if (doc.palette.length === 0 && fromSites.length === 0) {
    return [];
  }
  return [
    "## Components",
    ...(fromSites.length > 0
      ? [
          "",
          "As the brand's own website draws them. Match these before inventing new ones.",
          ...fromSites,
        ]
      : []),
    "",
    ...(accentOf(doc.palette) &&
    !doc.scans[0]?.components.some((c) => c.name === "button-primary")
      ? [
          "- **Primary button**: the main brand colour, with whichever brand colour reads on it at 4.5:1 or better, set in the body face.",
        ]
      : []),
    ...(doc.palette.length > 0
      ? [
          "- **Colour blocks** (`block-*`): brand colours as filled areas, with the brand colour that reads best on each for text.",
        ]
      : []),
  ];
};

const FILE_EXT = /\.(svg|png|jpe?g|webp|gif)$/i;
const logoName = (label: string) => label.replace(FILE_EXT, "") || "Logo";

const logos = (doc: BrandKitDoc): string[] =>
  doc.logos.length === 0
    ? []
    : [
        "## Logo",
        "",
        ...doc.logos.flatMap((logo) => [
          `### ${logoName(logo.label)}`,
          "",
          `![${logoName(logo.label)}](${logo.url})`,
          "",
          ...[
            logo.minWidth ? `- Never narrower than ${logo.minWidth}px.` : "",
            logo.clearSpace
              ? `- Keep clear space of ${pct(logo.clearSpace)} of its width on every side.`
              : "",
            logo.rules ? `- ${logo.rules}` : "",
          ].filter(Boolean),
          "",
        ]),
      ];

const imagery = (doc: BrandKitDoc): string[] => {
  if (doc.onBrand.length === 0 && doc.offBrand.length === 0) {
    return [];
  }
  const pics = (urls: string[]) => urls.map((u) => `![](${u})`).join(" ");
  return [
    "## Imagery",
    "",
    ...(doc.onBrand.length > 0
      ? ["**On brand**", "", pics(doc.onBrand), ""]
      : []),
    ...(doc.offBrand.length > 0
      ? ["**Not this**", "", pics(doc.offBrand), ""]
      : []),
  ];
};

const dosAndDonts = (doc: BrandKitDoc): string[] => {
  const dos = [
    accentOf(doc.palette)
      ? "Lead with the main brand colour; let neutrals carry the rest."
      : "",
    doc.typefaces.length > 0 ? "Set type only in the brand faces above." : "",
    ...doc.logos
      .filter((l) => l.minWidth)
      .map(
        (l) =>
          `Keep the ${logoName(l.label)} logo at least ${l.minWidth}px wide.`
      ),
  ].filter(Boolean);
  const donts = [
    doc.palette.length > 0
      ? "Don't introduce colours outside the palette."
      : "",
    "Don't redraw, recolour, stretch or add effects to the logo.",
    doc.offBrand.length > 0
      ? 'Don\'t use imagery like the "Not this" examples.'
      : "",
  ].filter(Boolean);
  return [
    "## Do's and Don'ts",
    "",
    ...dos.map((d) => `- Do: ${d}`),
    ...donts.map((d) => `- ${d}`),
  ];
};

const references = (doc: BrandKitDoc): string[] =>
  doc.references.length === 0
    ? []
    : [
        "## References",
        "",
        "Decisions, feedback and notes, newest first.",
        "",
        ...[...doc.references]
          .sort((a, b) => b.date.localeCompare(a.date))
          .flatMap((r) => [
            `- **${r.title || "Note"}**${r.date ? ` (${r.date})` : ""}: ${r.body.replace(/\s*\n\s*/g, " ")}${r.source ? ` Source: ${r.source}` : ""}`,
          ]),
      ];

/** The kit as DESIGN.md text. */
export const designMd = (kit: DesignMdKit): string => {
  const { colorNames, lines } = frontMatter(kit);
  const sections = [
    overview(kit),
    colors(kit.doc, colorNames),
    typography(kit.doc),
    kit.doc.typeScale && kit.doc.typeScale.spacing.length > 0
      ? scaleLayout(kit.doc.typeScale)
      : layoutSection(kit.doc.scans[0]),
    shapesSection(kit.doc.scans[0]),
    components(kit.doc),
    logos(kit.doc),
    imagery(kit.doc),
    dosAndDonts(kit.doc),
    references(kit.doc),
  ].filter((s) => s.length > 0);
  const body = sections.map((s) => s.join("\n").trimEnd()).join("\n\n");
  return `${lines.join("\n")}\n\n# ${kit.name}\n\n${body}\n`;
};
