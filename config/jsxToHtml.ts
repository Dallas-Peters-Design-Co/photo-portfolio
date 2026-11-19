/**
 * The static JSX componentSource writes for a preview, as HTML.
 *
 * Only that JSX: literal attributes (`"text"`, `{12}`, `{true}`), style
 * objects of literal values, bare boolean attributes, and text with braces
 * escaped as `{"{"}`. No expressions, components or spreads — the generator
 * never writes them. The docs script loads the HTML into a browser to scan
 * it for accessibility, where JSX cannot run.
 */

const ATTR_NAMES: Record<string, string> = {
  className: "class",
  clipRule: "clip-rule",
  defaultChecked: "checked",
  fillRule: "fill-rule",
  htmlFor: "for",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeMiterlimit: "stroke-miterlimit",
  strokeWidth: "stroke-width",
};

/** Style keys React writes without a unit when given a number. */
const UNITLESS = new Set([
  "flex",
  "fontWeight",
  "lineHeight",
  "opacity",
  "zIndex",
]);

const VOID = new Set(["br", "hr", "img", "input"]);
/** SVG shapes: inside <svg>, HTML keeps `/>` as self-closing. */
const SVG_SHAPES = new Set(["path", "circle", "rect", "ellipse", "line"]);

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const kebab = (key: string): string =>
  key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const STYLE_PAIR = /(\w+)\s*:\s*("(?:[^"\\]|\\.)*"|-?[\d.]+)/g;

const styleOf = (body: string): string =>
  [...body.matchAll(STYLE_PAIR)]
    .map(([, key = "", raw = ""]) => {
      const value = raw.startsWith('"')
        ? (JSON.parse(raw) as string)
        : `${raw}${UNITLESS.has(key) ? "" : "px"}`;
      return `${kebab(key)}: ${value}`;
    })
    .join("; ");

const ATTR =
  /^\s*([\w:-]+)(?:=(?:"((?:[^"\\]|\\.)*)"|\{\{((?:"(?:[^"\\]|\\.)*"|[^}"])*)\}\}|\{("(?:[^"\\]|\\.)*"|[^}]*)\}))?/;
const TAG_END = /^\s*(\/?)>/;
const CLOSING_TAG = /^<\/([\w-]+)\s*>/;
const OPENING_TAG = /^<([\w-]+)/;

/** An attribute written as `{expr}`: `true` is bare, `false` is dropped. */
const exprAttr = (attr: string, expr: string): string => {
  const value = expr.trim();
  if (value === "true") {
    return ` ${attr}`;
  }
  if (value === "false") {
    return "";
  }
  const literal = value.startsWith('"') ? (JSON.parse(value) as string) : value;
  return ` ${attr}="${escapeHtml(literal)}"`;
};

/** One tag's attributes, from just after its name to its `>` or `/>`. */
const readAttrs = (
  source: string,
  start: number
): { attrs: string; end: number; selfClosing: boolean } => {
  let at = start;
  const out: string[] = [];
  for (;;) {
    const rest = source.slice(at);
    const close = TAG_END.exec(rest);
    if (close) {
      return {
        attrs: out.join(""),
        end: at + close[0].length,
        selfClosing: close[1] === "/",
      };
    }
    const match = ATTR.exec(rest);
    if (!match) {
      throw new Error(`Unreadable attribute at ${at}: ${rest.slice(0, 40)}`);
    }
    const [whole, name = "", text, style, expr] = match;
    const attr = ATTR_NAMES[name] ?? name;
    if (style !== undefined) {
      out.push(` style="${escapeHtml(styleOf(style))}"`);
    } else if (text !== undefined) {
      out.push(` ${attr}="${escapeHtml(JSON.parse(`"${text}"`) as string)}"`);
    } else if (expr === undefined) {
      out.push(` ${attr}`);
    } else {
      out.push(exprAttr(attr, expr));
    }
    at += whole.length;
  }
};

/** Only scan text between tags for escaped JSX literals. Attribute values are
 * consumed by readAttrs, including quoted strings containing angle brackets. */
const TEXT_TOKEN = /<|\{("(?:[^"\\]|\\.)*")\}/g;

export const jsxToHtml = (jsx: string): string => {
  const tokens = new RegExp(TEXT_TOKEN);
  let html = "";
  let at = 0;
  while (at < jsx.length) {
    tokens.lastIndex = at;
    const token = tokens.exec(jsx);
    if (!token) {
      html += escapeHtml(jsx.slice(at));
      break;
    }
    const open = token.index;
    html += escapeHtml(jsx.slice(at, open));
    if (token[1] !== undefined) {
      html += escapeHtml(JSON.parse(token[1]) as string);
      at = tokens.lastIndex;
      continue;
    }
    const closing = CLOSING_TAG.exec(jsx.slice(open));
    if (closing) {
      html += `</${closing[1]}>`;
      at = open + closing[0].length;
      continue;
    }
    const name = OPENING_TAG.exec(jsx.slice(open))?.[1];
    if (!name) {
      throw new Error(`Unreadable tag at ${open}`);
    }
    const { attrs, end, selfClosing } = readAttrs(jsx, open + 1 + name.length);
    if (selfClosing && SVG_SHAPES.has(name)) {
      html += `<${name}${attrs} />`;
    } else {
      html += `<${name}${attrs}>`;
      // A self-closed element that HTML does not treat as void needs its end tag.
      if (selfClosing && !VOID.has(name)) {
        html += `</${name}>`;
      }
    }
    at = end;
  }
  return html;
};
