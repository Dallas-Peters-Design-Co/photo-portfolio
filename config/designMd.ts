import type { BrandKitDoc, PaletteEntry, TypefaceEntry } from "./brandKit.js";
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

const facesOf = (faces: TypefaceEntry[]) => {
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

const familyOf = (face: TypefaceEntry) =>
  parseFontRef(face.ref)?.family ?? face.name;

interface Tokens {
  colorNames: string[];
  lines: string[];
}

const frontMatter = (kit: DesignMdKit): Tokens => {
  const { doc } = kit;
  const colorNames = tokenNames(doc.palette, (p) => p.role || p.name, "color");
  const lines = [
    "---",
    "version: alpha",
    `name: ${yamlString(kit.name)}`,
    `description: ${yamlString(
      `Generated from the ${kit.name} brand kit${kit.version ? ` (version ${kit.version})` : ""}. Edit the kit, not this file.`
    )}`,
  ];
  if (doc.palette.length > 0) {
    lines.push("colors:");
    doc.palette.forEach((p, i) => {
      lines.push(`  ${colorNames[i]}: "${p.value}"`);
    });
  }
  const { body, headline } = facesOf(doc.typefaces);
  if (headline) {
    lines.push("typography:");
    lines.push("  headline:");
    lines.push(`    fontFamily: ${yamlString(familyOf(headline))}`);
    lines.push(
      `    fontWeight: ${headline.weights.length > 0 ? Math.max(...headline.weights) : 700}`
    );
    lines.push("    lineHeight: 1.05");
    if (body) {
      lines.push("  body:");
      lines.push(`    fontFamily: ${yamlString(familyOf(body))}`);
      lines.push("    fontWeight: 400");
      lines.push("    lineHeight: 1.5");
    }
  }
  const accent = accentOf(doc.palette);
  if (accent) {
    const at = doc.palette.indexOf(accent);
    const ink =
      [...doc.palette]
        .filter((p) => p !== accent)
        .sort(
          (a, b) =>
            contrast(b.value, accent.value) - contrast(a.value, accent.value)
        )[0] ?? null;
    const text =
      ink && contrast(ink.value, accent.value) >= 4.5
        ? `"{colors.${colorNames[doc.palette.indexOf(ink)]}}"`
        : `"${contrast("#ffffff", accent.value) >= contrast("#000000", accent.value) ? "#ffffff" : "#000000"}"`;
    lines.push("components:");
    lines.push("  button-primary:");
    lines.push(`    backgroundColor: "{colors.${colorNames[at]}}"`);
    lines.push(`    textColor: ${text}`);
    if (body) {
      lines.push(`    typography: "{typography.body}"`);
    }
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
    return [];
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
  ];
};

const components = (doc: BrandKitDoc): string[] =>
  accentOf(doc.palette)
    ? [
        "## Components",
        "",
        "- **Primary button**: the main brand colour, with whichever brand colour reads on it at 4.5:1 or better, set in the body face.",
      ]
    : [];

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
    components(kit.doc),
    logos(kit.doc),
    imagery(kit.doc),
    dosAndDonts(kit.doc),
    references(kit.doc),
  ].filter((s) => s.length > 0);
  const body = sections.map((s) => s.join("\n").trimEnd()).join("\n\n");
  return `${lines.join("\n")}\n\n# ${kit.name}\n\n${body}\n`;
};
