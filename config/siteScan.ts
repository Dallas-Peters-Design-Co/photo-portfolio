/**
 * What a scan of a brand's live website found: the components as the browser
 * actually draws them (buttons, links, inputs, cards, nav), the type scale,
 * and the corner radii and spacing the site uses most.
 *
 * Read in a real browser (scripts/scan-design.mjs) and stored on the kit, so
 * the DESIGN.md generator can describe the brand's components from the site
 * itself rather than guessing them from the palette.
 */

export interface ScannedStyle {
  backgroundColor?: string;
  border?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  height?: string;
  letterSpacing?: string;
  lineHeight?: string;
  padding?: string;
  rounded?: string;
  textColor?: string;
  textTransform?: string;
}

export interface ScannedComponent {
  /** How many elements on the page share this look. */
  count: number;
  /** button-primary, button-secondary, link, input, card, nav, badge… */
  name: string;
  /** A little of its text, so a person can tell which one it was. */
  sample: string;
  style: ScannedStyle;
}

export interface SiteScan {
  components: ScannedComponent[];
  /** Corner radii in use, most common first ("4px", "999px"). */
  rounded: string[];
  scannedAt: string;
  /** Spacing steps in use, smallest first ("8px", "16px"). */
  spacing: string[];
  title: string;
  /** h1, h2, h3, body, small… as set on the page. */
  typography: { name: string; style: ScannedStyle }[];
  url: string;
}

export const MAX_WEBSITES = 6;
const MAX_COMPONENTS = 24;
const MAX_STEPS = 8;
const MAX_TYPE = 8;

const STYLE_KEYS: (keyof ScannedStyle)[] = [
  "backgroundColor",
  "border",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "height",
  "letterSpacing",
  "lineHeight",
  "padding",
  "rounded",
  "textColor",
  "textTransform",
];

/**
 * CSS values only: no braces, semicolons, angle brackets, backticks or
 * backslashes. Quotes are allowed (font stacks need them); the DESIGN.md
 * writer quotes every value it puts in YAML.
 */
const SAFE = /^[^{}<>;\n\r`\\]{1,160}$/;
const NAME = /^[a-z][a-z0-9-]{0,40}$/;
const DIMENSION = /^-?\d+(\.\d+)?(px|em|rem)$/;
const HTTP = /^https?:\/\//i;

const text = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

export const sanitizeStyle = (input: unknown): ScannedStyle => {
  const raw = (input ?? {}) as Record<string, unknown>;
  const out: ScannedStyle = {};
  for (const key of STYLE_KEYS) {
    const value = text(raw[key], 160);
    if (value && SAFE.test(value)) {
      out[key] = value;
    }
  }
  return out;
};

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const sanitizeWebsites = (input: unknown): string[] =>
  [
    ...new Set(
      asArray(input)
        .map((u) => text(u, 300))
        .filter((u) => HTTP.test(u))
    ),
  ].slice(0, MAX_WEBSITES);

export const sanitizeScans = (input: unknown): SiteScan[] =>
  asArray(input)
    .map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      return {
        components: asArray(e.components)
          .map((c) => {
            const o = (c ?? {}) as Record<string, unknown>;
            return {
              count: Math.max(0, Math.min(Number(o.count) || 0, 100_000)),
              name: text(o.name, 41).toLowerCase(),
              sample: text(o.sample, 60),
              style: sanitizeStyle(o.style),
            };
          })
          .filter((c) => NAME.test(c.name))
          .slice(0, MAX_COMPONENTS),
        rounded: asArray(e.rounded)
          .map((r) => text(r, 20))
          .filter((r) => DIMENSION.test(r))
          .slice(0, MAX_STEPS),
        scannedAt: text(e.scannedAt, 30),
        spacing: asArray(e.spacing)
          .map((r) => text(r, 20))
          .filter((r) => DIMENSION.test(r))
          .slice(0, MAX_STEPS),
        title: text(e.title, 120),
        typography: asArray(e.typography)
          .map((t) => {
            const o = (t ?? {}) as Record<string, unknown>;
            return {
              name: text(o.name, 41).toLowerCase(),
              style: sanitizeStyle(o.style),
            };
          })
          .filter((t) => NAME.test(t.name))
          .slice(0, MAX_TYPE),
        url: text(e.url, 300),
      };
    })
    .filter((s) => HTTP.test(s.url))
    .slice(0, MAX_WEBSITES);

const HEX = /^#[0-9a-f]{6}$/i;

const rgb = (hex: string) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

/** Close enough to read as the same colour (RGB distance). */
const NEAR = 18;

/**
 * A scanned colour as a token reference when the palette has it (or very
 * nearly), else the colour itself.
 */
export const colorRef = (
  value: string | undefined,
  palette: { token: string; value: string }[]
): string | undefined => {
  if (!(value && HEX.test(value))) {
    return value;
  }
  const [r, g, b] = rgb(value);
  let best: { d: number; token: string } | null = null;
  for (const p of palette) {
    const [pr, pg, pb] = rgb(p.value);
    const d = Math.hypot(
      (r ?? 0) - (pr ?? 0),
      (g ?? 0) - (pg ?? 0),
      (b ?? 0) - (pb ?? 0)
    );
    if (d <= NEAR && (!best || d < best.d)) {
      best = { d, token: p.token };
    }
  }
  return best ? `{colors.${best.token}}` : value.toLowerCase();
};

/** "4px", "8px", "999px" → sm, md, … full, as the DESIGN.md scale names them. */
export const roundedScale = (values: string[]): [string, string][] => {
  const px = [...new Set(values)]
    .map((v) => ({ n: Number.parseFloat(v), v }))
    .filter((x) => Number.isFinite(x.n) && x.n > 0)
    .sort((a, b) => a.n - b.n);
  const full = px.filter((x) => x.n >= 100);
  const steps = px.filter((x) => x.n < 100).slice(0, 4);
  const names = ["sm", "md", "lg", "xl"];
  return [
    ...steps.map((x, i) => [names[i] ?? `r${i}`, x.v] as [string, string]),
    ...(full[0] ? [["full", full[0].v] as [string, string]] : []),
  ];
};

export const spacingScale = (values: string[]): [string, string][] => {
  const names = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];
  return [...new Set(values)]
    .map((v) => ({ n: Number.parseFloat(v), v }))
    .filter((x) => Number.isFinite(x.n) && x.n > 0)
    .sort((a, b) => a.n - b.n)
    .slice(0, names.length)
    .map((x, i) => [names[i] ?? `s${i}`, x.v]);
};
