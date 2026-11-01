import {
  colorRef,
  roundedScale,
  type ScannedStyle,
  type SiteScan,
  spacingScale,
} from "./siteScan.js";

/**
 * The parts of a DESIGN.md that come from scanning the brand's website: the
 * component tokens, the radius and spacing scales, the extra type steps, and
 * the prose that says where they came from. See config/designMd.ts.
 */

export interface ColorToken {
  token: string;
  value: string;
}

const PROPS: [keyof ScannedStyle, string][] = [
  ["backgroundColor", "backgroundColor"],
  ["textColor", "textColor"],
  ["rounded", "rounded"],
  ["padding", "padding"],
  ["height", "height"],
];

const TYPE_PROPS: [keyof ScannedStyle, string][] = [
  ["fontFamily", "fontFamily"],
  ["fontSize", "fontSize"],
  ["fontWeight", "fontWeight"],
  ["lineHeight", "lineHeight"],
  ["letterSpacing", "letterSpacing"],
];

const quote = (v: string) => JSON.stringify(v);

/** The first family in a CSS stack, unquoted. */
const firstFamily = (stack: string) =>
  stack.split(",")[0]?.replace(/["']/g, "").trim() ?? stack;

export interface ScanTokens {
  components: string[];
  /** Whether the scan supplied the primary button, so the kit's isn't needed. */
  hasPrimaryButton: boolean;
  rounded: string[];
  spacing: string[];
  /** Type steps to add beside the kit's headline and body. */
  typography: string[];
  /** Colour tokens the scanned components point at. */
  used: Set<string>;
}

const roundedRef = (value: string | undefined, scale: [string, string][]) => {
  const hit = scale.find(([, v]) => v === value);
  return hit ? `{rounded.${hit[0]}}` : value;
};

const COLOR_REF = /^\{colors\.(.+)\}$/;

const typeLines = (scan: SiteScan, taken: Set<string>): string[] =>
  scan.typography
    .filter((t) => !taken.has(t.name))
    .flatMap((t) => {
      const props = TYPE_PROPS.filter(([key]) => t.style[key]).map(
        ([key, name]) => {
          const v = t.style[key] as string;
          return `    ${name}: ${key === "fontFamily" ? quote(firstFamily(v)) : v}`;
        }
      );
      return props.length > 0 ? [`  ${t.name}:`, ...props] : [];
    });

/** One component's properties as YAML lines, noting which colours it uses. */
const componentProps = (
  style: ScannedStyle,
  palette: ColorToken[],
  radii: [string, string][],
  used: Set<string>
): string[] =>
  PROPS.filter(([key]) => style[key]).map(([key, name]) => {
    let v = style[key] as string;
    if (key === "backgroundColor" || key === "textColor") {
      v = colorRef(v, palette) ?? v;
      const token = COLOR_REF.exec(v)?.[1];
      if (token) {
        used.add(token);
      }
    } else if (key === "rounded") {
      v = roundedRef(v, radii) ?? v;
    }
    return `    ${name}: ${quote(v)}`;
  });

export const scanTokens = (
  scan: SiteScan | undefined,
  palette: ColorToken[],
  taken: Set<string>
): ScanTokens => {
  const used = new Set<string>();
  if (!scan) {
    return {
      components: [],
      hasPrimaryButton: false,
      rounded: [],
      spacing: [],
      typography: [],
      used,
    };
  }
  const radii = roundedScale(scan.rounded);
  const components = scan.components.flatMap((c) => {
    const props = componentProps(c.style, palette, radii, used);
    return props.length > 0 ? [`  ${c.name}:`, ...props] : [];
  });
  return {
    components,
    hasPrimaryButton: components.includes("  button-primary:"),
    rounded: radii.map(([k, v]) => `  ${k}: ${v}`),
    spacing: spacingScale(scan.spacing).map(([k, v]) => `  ${k}: ${v}`),
    typography: typeLines(scan, taken),
    used,
  };
};

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const describe = (s: ScannedStyle): string =>
  [
    s.backgroundColor ? `fill ${s.backgroundColor}` : "",
    s.textColor ? `text ${s.textColor}` : "",
    s.fontFamily
      ? `${firstFamily(s.fontFamily)}${s.fontSize ? ` ${s.fontSize}` : ""}${s.fontWeight ? `/${s.fontWeight}` : ""}`
      : "",
    s.textTransform && s.textTransform !== "none" ? s.textTransform : "",
    s.letterSpacing && s.letterSpacing !== "normal"
      ? `tracking ${s.letterSpacing}`
      : "",
    s.rounded ? `radius ${s.rounded}` : "",
    s.padding ? `padding ${s.padding}` : "",
    s.border ? `border ${s.border}` : "",
  ]
    .filter(Boolean)
    .join(", ");

/** The "Layout" section: the spacing steps the site uses. */
export const layoutSection = (scan: SiteScan | undefined): string[] => {
  const steps = scan ? spacingScale(scan.spacing) : [];
  return steps.length === 0
    ? []
    : [
        "## Layout",
        "",
        `Spacing steps in use on ${host(scan?.url ?? "")}: ${steps.map(([k, v]) => `${k} ${v}`).join(", ")}. Keep to these.`,
      ];
};

/** The "Shapes" section: corner radii. */
export const shapesSection = (scan: SiteScan | undefined): string[] => {
  const radii = scan ? roundedScale(scan.rounded) : [];
  return radii.length === 0
    ? []
    : [
        "## Shapes",
        "",
        `Corner radii in use: ${radii.map(([k, v]) => `${k} ${v}`).join(", ")}.`,
      ];
};

/** Component prose from every scanned site, with where each came from. */
export const scannedComponentLines = (scans: SiteScan[]): string[] =>
  scans.flatMap((scan) =>
    scan.components.length === 0
      ? []
      : [
          "",
          `From [${host(scan.url)}](${scan.url})${scan.scannedAt ? `, scanned ${scan.scannedAt.slice(0, 10)}` : ""}:`,
          "",
          ...scan.components.map(
            (c) =>
              `- **${c.name}**${c.sample ? ` ("${c.sample}")` : ""}: ${describe(c.style)}`
          ),
        ]
  );
