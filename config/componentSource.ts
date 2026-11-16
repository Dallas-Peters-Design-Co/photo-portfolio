import { conceptFontStack } from "./conceptFont.js";
import { shadowCss } from "./conceptShadow.js";
import { DEFAULT_BORDERS, tableOf } from "./conceptTable.js";
import {
  type ReviewConceptElement,
  type ReviewConceptElementKind,
  splitCardText,
} from "./reviewConcept.js";

/**
 * A brand kit component style as source to paste into another project: one
 * React component and the plain CSS it is drawn with.
 *
 * Plain CSS on one BEM class, with the look in custom properties at the top,
 * so the receiving project can retheme it without reading the rules. No
 * dependency beyond React: the markup is native elements with their ARIA,
 * which is enough for a static look and is where a behaviour library (focus,
 * dismissal, keyboard) would be wired in by the project that adopts it.
 */

export interface ComponentSource {
  /** The class the CSS defines, e.g. `button-primary`. */
  className: string;
  css: string;
  /** The component's name, e.g. `ButtonPrimary`. */
  name: string;
  /**
   * The component drawn once with its sample content, as JSX with no
   * expressions but literals: for a page (MDX) that has the CSS but cannot
   * import the component.
   */
  preview: string;
  tsx: string;
}

const WORD = /[a-z0-9]+/gi;

const words = (value: string): string[] =>
  value.match(WORD)?.map((w) => w.toLowerCase()) ?? [];

const pascal = (parts: string[]): string =>
  parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");

/** `button` + `Primary` → `button-primary`; a name that repeats the kind is not doubled. */
const slugOf = (kind: string, name: string): string[] => {
  const named = words(name);
  return named[0] === kind ? named : [kind, ...named];
};

const px = (n: number | undefined): string | undefined =>
  n === undefined ? undefined : `${n}px`;

/** The look as custom properties, in a fixed order; unset ones are left out. */
const tokensOf = (el: ReviewConceptElement): [string, string][] => {
  const border =
    el.borderColor && el.borderColor !== "transparent"
      ? `${el.borderWidth ?? 1}px solid ${el.borderColor}`
      : "none";
  const entries: [string, string | undefined][] = [
    ["background", el.background],
    ["color", el.color],
    ["font-family", conceptFontStack(el.fontFamily, el.fontRef, el.fontId)],
    ["font-size", px(el.fontSize)],
    ["font-weight", String(el.fontWeight)],
    ["line-height", String(el.lineHeight)],
    ["padding", `${el.paddingY}px ${el.paddingX}px`],
    ["radius", px(el.radius)],
    ["border", border],
    ["shadow", el.shadow ? shadowCss(el.shadow) : "none"],
    ["accent", el.accentColor],
    ["check-size", px(el.checkSize)],
    ["bar-height", px(el.barHeight)],
    ["body-size", px(el.bodySize)],
    ["title-weight", el.titleWeight ? String(el.titleWeight) : undefined],
    ["icon-color", el.iconColor],
    ["icon-size", px(el.iconSize)],
    ["hover-background", el.hover?.background],
    ["hover-color", el.hover?.color],
    ["hover-border-color", el.hover?.borderColor],
    ["hover-shadow", el.hover?.shadow ? shadowCss(el.hover.shadow) : undefined],
  ];
  return entries.filter((e): e is [string, string] => e[1] !== undefined);
};

/** Per kind: the element, its attributes and what goes inside. */
interface Markup {
  attrs?: string;
  /** Inner JSX, indented by the caller. */
  body?: string;
  /** Extra CSS rules after the base rule; `&` is the block class. */
  css?: string;
  /** Children are passed through instead of a fixed body. */
  passChildren?: boolean;
  props?: string;
  tag: string;
}

const HOVER_CSS = `&:hover {
  background: var(--&-hover-background, var(--&-background));
  color: var(--&-hover-color, var(--&-color));
  border-color: var(--&-hover-border-color, currentColor);
  box-shadow: var(--&-hover-shadow, var(--&-shadow));
}`;

const FOCUS_CSS = `&:focus-visible {
  outline: 2px solid var(--&-accent, currentColor);
  outline-offset: 2px;
}`;

const quote = (value: string): string => JSON.stringify(value);

const tableMarkup = (el: ReviewConceptElement): Markup => {
  const table = tableOf(el);
  const borders = table.borders ?? DEFAULT_BORDERS;
  const head = table.columns
    .map((c) => `        <th scope="col">${c.label}</th>`)
    .join("\n");
  const rows = table.rows
    .slice(0, 3)
    .map(
      (row) =>
        `      <tr>\n${table.columns
          .map((_, i) => `        <td>${row[i] ?? ""}</td>`)
          .join("\n")}\n      </tr>`
    )
    .join("\n");
  const line = `${borders.width}px solid ${borders.color ?? "color-mix(in srgb, currentColor 14%, transparent)"}`;
  return {
    body: `  <thead>\n    <tr>\n${head}\n    </tr>\n  </thead>\n  <tbody>\n${rows}\n  </tbody>`,
    css: `& { border-collapse: collapse; padding: 0; }
& th, & td { padding: var(--&-padding); text-align: start; ${borders.lines === "none" ? "" : `border-bottom: ${line};`} }
& thead { background: ${table.header?.background ?? "transparent"}; color: ${table.header?.color ?? "inherit"}; }`,
    tag: "table",
  };
};

const markupOf = (el: ReviewConceptElement): Markup => {
  const byKind: Partial<Record<ReviewConceptElementKind, () => Markup>> = {
    badge: () => ({ passChildren: true, tag: "span" }),
    button: () => ({
      attrs: 'type="button"',
      css: `& { cursor: pointer; }\n${HOVER_CSS}\n${FOCUS_CSS}`,
      passChildren: true,
      props: "onClick",
      tag: "button",
    }),
    card: () => ({
      body: "  <h3>{title}</h3>\n  <p>{children}</p>",
      css: "& > h3 { margin: 0; font-size: inherit; font-weight: var(--&-title-weight, 600); }\n& > p { margin: 0.25em 0 0; font-size: var(--&-body-size, 0.875em); }",
      props: "title",
      tag: "article",
    }),
    checkbox: () => ({
      body: `  <input type="checkbox" />\n  {children}`,
      css: "& { display: inline-flex; align-items: center; gap: 0.5em; cursor: pointer; }\n& > input { accent-color: var(--&-accent); inline-size: var(--&-check-size, 1em); block-size: var(--&-check-size, 1em); margin: 0; }",
      tag: "label",
    }),
    dialog: () => ({
      attrs: 'role="dialog" aria-modal="true"',
      passChildren: true,
      tag: "div",
    }),
    divider: () => ({
      css: "& { border: 0; border-top: var(--&-border); padding: 0; margin: 0; }",
      tag: "hr",
    }),
    input: () => ({
      attrs: `type=${quote(el.inputType ?? "text")} placeholder=${quote(el.placeholder ?? "")}`,
      css: FOCUS_CSS,
      tag: "input",
    }),
    label: () => ({ passChildren: true, tag: "label" }),
    link: () => ({
      attrs: 'href="#"',
      css: `& { text-decoration: underline; text-underline-offset: 0.2em; }\n${HOVER_CSS}`,
      passChildren: true,
      tag: "a",
    }),
    menu: () => ({
      attrs: 'role="menu"',
      body: (el.options ?? ["First", "Second"])
        .map((o) => `  <button role="menuitem" type="button">${o}</button>`)
        .join("\n"),
      css: "& { display: grid; }\n& > button { all: unset; cursor: pointer; padding: var(--&-padding); }",
      tag: "div",
    }),
    progress: () => ({
      attrs: `max={100} value={${el.progress ?? 60}}`,
      css: "& { appearance: none; inline-size: 100%; block-size: var(--&-bar-height, 6px); padding: 0; border: 0; }\n&::-webkit-progress-bar { background: var(--&-background); border-radius: var(--&-radius); }\n&::-webkit-progress-value { background: var(--&-accent); border-radius: var(--&-radius); }\n&::-moz-progress-bar { background: var(--&-accent); border-radius: var(--&-radius); }",
      tag: "progress",
    }),
    select: () => ({
      body: (el.options ?? ["First", "Second"])
        .map((o) => `  <option>${o}</option>`)
        .join("\n"),
      css: FOCUS_CSS,
      tag: "select",
    }),
    skeleton: () => ({
      attrs: 'aria-hidden="true"',
      css: "& { min-block-size: 1em; }",
      tag: "div",
    }),
    table: () => tableMarkup(el),
    tabs: () => ({
      attrs: 'role="tablist"',
      body: (el.options ?? ["One", "Two"])
        .map(
          (o, i) =>
            `  <button role="tab" type="button" aria-selected={${i === 0}}>${o}</button>`
        )
        .join("\n"),
      css: "& { display: flex; gap: 1em; }\n& > [role=tab] { all: unset; cursor: pointer; }\n& > [aria-selected=true] { box-shadow: inset 0 -2px 0 var(--&-accent, currentColor); }",
      tag: "div",
    }),
    tag: () => ({ passChildren: true, tag: "span" }),
    text: () => ({ passChildren: true, tag: "p" }),
    textarea: () => ({
      attrs: `placeholder=${quote(el.placeholder ?? "")}`,
      css: FOCUS_CSS,
      tag: "textarea",
    }),
    toast: () => ({
      attrs: 'role="status"',
      passChildren: true,
      tag: "div",
    }),
  };
  return (byKind[el.kind]?.() ?? {
    passChildren: true,
    tag: "div",
  }) satisfies Markup;
};

/** Text set inside JSX: braces and angle brackets would be read as code. */
const escapeJsx = (value: string): string =>
  value.replace(/[{}<>]/g, (c) => `{${JSON.stringify(c)}}`);

/** Default text for components that take children, shown in the usage line. */
const sampleText = (el: ReviewConceptElement): string =>
  el.text.split("\n")[0]?.trim() || "Label";

export const componentSource = (
  element: ReviewConceptElement,
  styleName: string
): ComponentSource => {
  const slug = slugOf(element.kind, styleName);
  const className = slug.join("-");
  const name = pascal(slug);
  const markup = markupOf(element);
  const tokens = tokensOf(element);

  const vars = tokens.map(([k, v]) => `  --${className}-${k}: ${v};`);
  const base = [
    "  box-sizing: border-box;",
    `  background: var(--${className}-background);`,
    `  color: var(--${className}-color);`,
    `  font-family: var(--${className}-font-family);`,
    `  font-size: var(--${className}-font-size);`,
    `  font-weight: var(--${className}-font-weight);`,
    `  line-height: var(--${className}-line-height);`,
    `  padding: var(--${className}-padding);`,
    `  border-radius: var(--${className}-radius);`,
    `  border: var(--${className}-border);`,
    `  box-shadow: var(--${className}-shadow);`,
  ];
  // `&` stands for the block: `--&-x` is a token, a bare `&` is the selector.
  const extra = (markup.css ?? "")
    .replaceAll("--&-", `--${className}-`)
    .replaceAll("&", `.${className}`);
  const css = `.${className} {\n${vars.join("\n")}\n\n${base.join("\n")}\n}\n${extra ? `\n${extra}\n` : ""}`;

  const props = [
    "className",
    ...(markup.passChildren || markup.body?.includes("{children}")
      ? ["children"]
      : []),
    ...(markup.props ? markup.props.split(",") : []),
  ];
  const propTypes = props
    .map((p) => {
      if (p === "children") {
        return "  children?: React.ReactNode;";
      }
      if (p === "onClick") {
        return "  onClick?: () => void;";
      }
      return `  ${p}?: string;`;
    })
    .join("\n");
  const attrs = [
    `className={className ? \`${className} \${className}\` : "${className}"}`,
    ...(markup.attrs ? [markup.attrs] : []),
    ...(markup.props?.includes("onClick") ? ["onClick={onClick}"] : []),
  ].join(" ");
  const inner = markup.passChildren ? "  {children}" : markup.body;
  const jsx = inner
    ? `    <${markup.tag} ${attrs}>\n${inner
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n")}\n    </${markup.tag}>`
    : `    <${markup.tag} ${attrs} />`;
  const defaults = props
    .map((p) => {
      if (p === "children" && markup.passChildren) {
        return `children = ${quote(sampleText(element))}`;
      }
      if (p === "title") {
        return `title = ${quote(sampleText(element))}`;
      }
      return p;
    })
    .join(", ");

  const tsx = `import type * as React from "react";
import "./${name}.css";

interface ${name}Props {
${propTypes}
}

/** ${styleName} ${element.kind}, from the brand kit. */
export function ${name}({ ${defaults} }: ${name}Props) {
  return (
${jsx}
  );
}
`;
  const { body: cardBody, title: cardTitle } = splitCardText(element.text);
  const previewInner = inner
    ?.replaceAll("{children}", escapeJsx(cardBody || sampleText(element)))
    .replaceAll("{title}", escapeJsx(cardTitle || sampleText(element)));
  const previewAttrs = [
    `className="${className}"`,
    ...(markup.attrs ? [markup.attrs] : []),
  ].join(" ");
  const preview = previewInner
    ? `<${markup.tag} ${previewAttrs}>\n${previewInner}\n</${markup.tag}>`
    : `<${markup.tag} ${previewAttrs} />`;
  return { className, css, name, preview, tsx };
};

/** Both files in one paste, each under its file name. */
export const componentSourceText = (source: ComponentSource): string =>
  `// ${source.name}.tsx\n${source.tsx}\n/* ${source.name}.css */\n${source.css}`;
