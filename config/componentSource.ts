import {
  dialogMarkup,
  inputMarkup,
  menuMarkup,
  selectMarkup,
  toastMarkup,
  withIcons,
} from "./componentSourceKinds.js";
import {
  cardMarkup,
  checkboxMarkup,
  type Draw,
  escapeJsx,
  groupMarkup,
  HOVER_CSS,
  logoMarkup,
  type Markup,
  navbarMarkup,
  panelMarkup,
  progressMarkup,
  tabsMarkup,
} from "./componentSourceParts.js";
import { tableMarkup } from "./componentSourceTable.js";
import { conceptFontStack } from "./conceptFont.js";
import { takesBox } from "./conceptKinds.js";
import { shadowCss, shadowOf } from "./conceptShadow.js";
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
 * Most use native elements. The select uses Base UI for its styled popup,
 * keyboard behavior and focus management.
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
  /** Initial value for the interactive select preview in the docs. */
  previewValue?: string;
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

/** Kinds outlined by default, and how strongly (percent of the text colour). */
const FAINT: Partial<Record<string, number>> = {
  card: 30,
  input: 25,
  panel: 30,
  select: 25,
  textarea: 25,
};

/** The look as custom properties, in a fixed order; unset ones are left out. */
const tokensOf = (el: ReviewConceptElement): [string, string][] => {
  // As the app draws the box: a border and shadow only on kinds that take
  // one, the form fields and cards outlined faintly when given no colour.
  const boxed = takesBox(el.kind);
  let border = "none";
  if (boxed && el.borderColor) {
    border = `${el.borderWidth ?? 1}px solid ${el.borderColor}`;
  } else if (boxed && FAINT[el.kind]) {
    border = `1px solid color-mix(in srgb, currentColor ${FAINT[el.kind]}%, transparent)`;
  }
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
    ["shadow", boxed ? shadowCss(shadowOf(el)) : "none"],
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

const FOCUS_CSS = `&:focus-visible {
  outline: 2px solid var(--&-accent, currentColor);
  outline-offset: 2px;
}`;

const quote = (value: string): string => JSON.stringify(value);

const markupOf = (el: ReviewConceptElement, draw: Draw): Markup => {
  const byKind: Partial<Record<ReviewConceptElementKind, () => Markup>> = {
    badge: () => withIcons(el, { passChildren: true, tag: "span" }),
    button: () =>
      withIcons(el, {
        attrs: 'type="button"',
        css: `& { cursor: pointer; }\n${HOVER_CSS}\n${FOCUS_CSS}`,
        passChildren: true,
        props: "onClick",
        tag: "button",
      }),
    card: () => cardMarkup(el, draw),
    checkbox: () => checkboxMarkup(el),
    dialog: () => dialogMarkup(el, sampleText(el)),
    divider: () => ({
      css: "& { border: 0; border-top: var(--&-border); padding: 0; margin: 0; }",
      tag: "hr",
    }),
    group: () => groupMarkup(el, draw),
    input: () => inputMarkup(el, FOCUS_CSS),
    label: () => ({ passChildren: true, tag: "label" }),
    link: () => ({
      attrs: 'href="#"',
      css: `& { text-decoration: underline; text-underline-offset: 0.2em; }\n${HOVER_CSS}`,
      passChildren: true,
      tag: "a",
    }),
    logo: () => logoMarkup(el),
    menu: () => menuMarkup(el),
    navbar: () => navbarMarkup(el, draw),
    panel: () => panelMarkup(el, draw),
    progress: () => progressMarkup(el),
    select: () => selectMarkup(el, FOCUS_CSS),
    skeleton: () => ({
      attrs: 'aria-hidden="true"',
      css: "& { min-block-size: 1em; }",
      tag: "div",
    }),
    table: () => tableMarkup(el),
    tabs: () => tabsMarkup(el),
    tag: () => withIcons(el, { passChildren: true, tag: "span" }),
    text: () => ({ passChildren: true, tag: "p" }),
    textarea: () => ({
      attrs: `placeholder=${quote(el.placeholder ?? "")}`,
      css: FOCUS_CSS,
      tag: "textarea",
    }),
    toast: () => toastMarkup(el),
    upload: () => ({
      body: `<input className="@@__input" type="file" />\n<span>{children}</span>${
        el.placeholder
          ? `\n<span className="@@__file">${escapeJsx(el.placeholder)}</span>`
          : ""
      }`,
      css: `& { display: grid; gap: 8px; place-items: center; text-align: center; border-style: dashed; cursor: pointer; }
&:focus-within { outline: 2px solid var(--&-accent, currentColor); outline-offset: 2px; }
&__input { position: absolute; width: 1px; height: 1px; opacity: 0; }
&__file { padding: 4px 10px; font-weight: 600; background: color-mix(in srgb, currentColor 8%, transparent); border-radius: 999px; }`,
      tag: "label",
    }),
  };
  return (byKind[el.kind]?.() ?? {
    passChildren: true,
    tag: "div",
  }) satisfies Markup;
};

/** Default text for components that take children, shown in the usage line. */
const sampleText = (el: ReviewConceptElement): string =>
  el.text.split("\n")[0]?.trim() || "Label";

/** The element's CSS under a class: its tokens, the base rule, its own rules. */
const cssOf = (
  element: ReviewConceptElement,
  markup: Markup,
  cls: string
): string => {
  const own = new Map(markup.tokens ?? []);
  const tokens = [
    ...tokensOf(element).map(([k, v]): [string, string] => [
      k,
      own.get(k) ?? v,
    ]),
    ...[...own].filter(([k]) => !tokensOf(element).some(([t]) => t === k)),
  ];
  const vars = tokens.map(([k, v]) => `  --${cls}-${k}: ${v};`);
  const base = [
    "box-sizing: border-box;",
    "background: var(--&-background);",
    "color: var(--&-color);",
    "font-family: var(--&-font-family);",
    "font-size: var(--&-font-size);",
    "font-weight: var(--&-font-weight);",
    "line-height: var(--&-line-height);",
    "padding: var(--&-padding);",
    "border-radius: var(--&-radius);",
    "border: var(--&-border);",
    "box-shadow: var(--&-shadow);",
  ].map((line) => `  ${line.replaceAll("--&-", `--${cls}-`)}`);
  // `&` stands for the block: `--&-x` is a token, a bare `&` is the selector.
  const extra = (markup.css ?? "")
    .replaceAll("--&-", `--${cls}-`)
    .replaceAll("&", `.${cls}`);
  const children = (markup.childCss ?? "").replaceAll("@@", cls);
  return [
    `.${cls} {\n${vars.join("\n")}\n\n${base.join("\n")}\n}`,
    extra,
    children,
  ]
    .filter(Boolean)
    .join("\n\n");
};

/** The inner JSX with its props filled in from the sample, for a page. */
const literalInner = (element: ReviewConceptElement, inner: string): string => {
  const { body, title } = splitCardText(element.text);
  const isCard = element.kind === "card";
  return inner
    .replaceAll(
      "{children}",
      escapeJsx(isCard ? body : body || sampleText(element))
    )
    .replaceAll("{title}", escapeJsx(title || sampleText(element)));
};

const wrap = (tag: string, attrs: string, inner?: string): string =>
  inner
    ? `<${tag} ${attrs}>\n${inner
        .split("\n")
        .map((l) => (l ? `  ${l}` : l))
        .join("\n")}\n</${tag}>`
    : `<${tag} ${attrs} />`;

/** An element drawn once, statically, under a class: for previews and slots. */
const drawStatic: Draw = (element, cls) => {
  const markup = markupOf(element, drawStatic);
  const inner = markup.passChildren
    ? escapeJsx(element.text || sampleText(element))
    : markup.body && literalInner(element, markup.body);
  const attrs = [`className="${cls}"`, ...(markup.attrs ? [markup.attrs] : [])];
  return {
    css: cssOf(element, markup, cls),
    jsx: wrap(markup.tag, attrs.join(" "), inner?.replaceAll("@@", cls)),
  };
};

export const componentSource = (
  element: ReviewConceptElement,
  styleName: string
): ComponentSource => {
  const slug = slugOf(element.kind, styleName);
  const className = slug.join("-");
  const name = pascal(slug);
  const markup = markupOf(element, drawStatic);
  const { css, jsx: preview } = drawStatic(element, className);
  if (markup.tsx) {
    return {
      className,
      css,
      name,
      preview,
      ...(element.kind === "select"
        ? {
            previewValue:
              element.text.trim() || element.options?.[0] || "Choose",
          }
        : {}),
      tsx: markup.tsx(name, className),
    };
  }

  const props = [
    "className",
    ...(markup.passChildren || markup.body?.includes("{children}")
      ? ["children"]
      : []),
    ...(markup.body?.includes("{title}") ? ["title"] : []),
    ...(markup.props === "onClick" ? ["onClick"] : []),
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
    ...(props.includes("onClick") ? ["onClick={onClick}"] : []),
  ].join(" ");
  const inner = markup.passChildren
    ? "{children}"
    : markup.body?.replaceAll("@@", className);
  const jsx = wrap(markup.tag, attrs, inner)
    .split("\n")
    .map((l) => (l ? `    ${l}` : l))
    .join("\n");
  const { body, title } = splitCardText(element.text);
  const defaults = props
    .map((p) => {
      if (p === "children") {
        const text = element.kind === "card" ? body : sampleText(element);
        return text ? `children = ${quote(text)}` : p;
      }
      if (p === "title") {
        return `title = ${quote(title || sampleText(element))}`;
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
  return { className, css, name, preview, tsx };
};

/** Both files in one paste, each under its file name. */
export const componentSourceText = (source: ComponentSource): string =>
  `// ${source.name}.tsx\n${source.tsx}\n/* ${source.name}.css */\n${source.css}`;
