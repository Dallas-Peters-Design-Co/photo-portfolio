import { flexSize } from "./conceptFlex.js";
import { type ConceptIconSvg, conceptIconName } from "./conceptIcon.js";
import { iconSizeOf } from "./conceptKinds.js";
import {
  type ConceptSlot,
  type ConceptSlotName,
  LAYOUT_SLOTS,
  mapChildren,
  panelHandleElements,
  SLOT_DEFAULTS,
} from "./conceptSlots.js";
import { type ReviewConceptElement, splitCardText } from "./reviewConcept.js";

/** Looks an icon's drawing up by its Hugeicons name. */
export type IconLookup = (name: string) => ConceptIconSvg | undefined;

/**
 * The element with a drawing for every icon it names but does not carry
 * (styles saved before drawings were stored), in its slots too, so the
 * copied code draws the icon the app does.
 */
export const withIconDrawings = (
  element: ReviewConceptElement,
  lookup: IconLookup
): ReviewConceptElement => {
  const name = element.iconSvg ? null : conceptIconName(element.iconName);
  const svg = name ? lookup(name) : undefined;
  const endName = element.iconEndSvg
    ? null
    : conceptIconName(element.iconEndName);
  const endSvg = endName ? lookup(endName) : undefined;
  return {
    ...mapChildren(element, (child) => withIconDrawings(child, lookup)),
    ...(svg ? { iconSvg: svg } : {}),
    ...(endSvg ? { iconEndSvg: endSvg } : {}),
  };
};

/**
 * The parts of componentSource that draw more than one box: a card's icon,
 * title and slots, a panel's slots, tabs and their indicator, a progress
 * bar's label and track. Each mirrors how the app draws it
 * (src/components/review: ReviewConceptElementView, ConceptSlotsView,
 * ConceptTabsPreview, ConceptProgressPreview), so the copied component and
 * the docs preview look like the kit.
 *
 * In a body, `@@` stands for the block's class; in CSS, `&` does.
 */

/** Per kind: the element, its attributes and what goes inside. */
export interface Markup {
  attrs?: string;
  /** Inner JSX, indented by the caller. `{children}` and `{title}` are props. */
  body?: string;
  /** CSS of the elements nested in its slots, already under their classes. */
  childCss?: string;
  /** Extra CSS rules after the base rule. */
  css?: string;
  /** Children are passed through instead of a fixed body. */
  passChildren?: boolean;
  props?: string;
  tag: string;
  /** Tokens that replace the base ones (tabs pad the row, not each tab). */
  tokens?: [string, string][];
  /** A component of its own, for kinds that keep state (tabs). */
  tsx?: (name: string, cls: string) => string;
}

/** An element drawn statically under a class: its CSS and its JSX. */
export type Draw = (
  element: ReviewConceptElement,
  className: string
) => { css: string; jsx: string };

/** Text set inside JSX: braces and angle brackets would be read as code. */
export const escapeJsx = (value: string): string =>
  value.replace(/[{}<>]/g, (c) => `{${JSON.stringify(c)}}`);

export const HOVER_CSS = `&:hover {
  background: var(--&-hover-background, var(--&-background));
  color: var(--&-hover-color, var(--&-color));
  border-color: var(--&-hover-border-color, currentColor);
  box-shadow: var(--&-hover-shadow, var(--&-shadow));
}`;

export const indent = (text: string, by = "  "): string =>
  text
    .split("\n")
    .map((line) => (line ? `${by}${line}` : line))
    .join("\n");

/** An icon's drawing as an inline SVG under a class, stroked in currentColor. */
export const iconSvgJsx = (
  svg: ConceptIconSvg | undefined,
  size: number,
  cls = "@@__icon"
): string => {
  if (!svg?.length) {
    return "";
  }
  const parts = svg.map(([tag, attrs]) => {
    const own = Object.entries(attrs)
      .filter(([key]) => key !== "key" && key !== "strokeWidth")
      .map(([key, value]) => `${key}=${JSON.stringify(String(value))}`)
      .join(" ");
    return `  <${tag} ${own} strokeWidth="2" />`;
  });
  return `<svg className="${cls}" width={${size}} height={${size}} viewBox="0 0 24 24" fill="none" aria-hidden="true">\n${parts.join("\n")}\n</svg>`;
};

/** A kit icon's drawing as an inline SVG, stroked in currentColor. */
const svgJsx = (element: ReviewConceptElement): string =>
  iconSvgJsx(element.iconSvg, iconSizeOf(element));

const JUSTIFY = {
  between: "space-between",
  center: "center",
  end: "flex-end",
  start: "flex-start",
} as const;
const ALIGN = {
  center: "center",
  end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
} as const;

const itemsStyle = (slot: ConceptSlot): string => {
  const style: string[] = [`gap: ${slot.gap ?? SLOT_DEFAULTS.gap}`];
  if (slot.layout === "row") {
    style.push(`flexWrap: "${slot.wrap === false ? "nowrap" : "wrap"}"`);
  }
  if (slot.align) {
    style.push(`alignItems: "${ALIGN[slot.align]}"`);
  }
  if (slot.justify) {
    style.push(`justifyContent: "${JUSTIFY[slot.justify]}"`);
  }
  if (slot.layout === "grid") {
    style.push(
      `gridTemplateColumns: "repeat(${slot.columns ?? SLOT_DEFAULTS.columns}, minmax(0, 1fr))"`
    );
  }
  return `{{ ${style.join(", ")} }}`;
};

/** ConceptSlotsView.css, under the block's class. */
const SLOTS_CSS = `&__slots { display: flex; flex-direction: column; min-width: 0; }
&__slots:not([data-dividers]) { gap: 12px; }
&__slots[data-dividers] > &__slot + &__slot { border-top: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
&__slot, &__items { display: flex; flex-direction: column; min-width: 0; }
&__items { align-items: flex-start; }
&__slot[data-led] { flex-direction: row; flex-wrap: wrap; align-items: center; }
&__slot[data-led] > &__items { flex: 0 0 auto; }
&__items[data-layout="row"] { flex-direction: row; align-items: center; }
&__items[data-layout="grid"] { display: grid; }
&__items[data-fill] > * { align-self: stretch; width: auto; min-width: 0; }
&__items[data-fill][data-layout="row"] > :not([data-flex-item]) { flex: 1 1 0; }
&__slot[data-led] > &__items[data-fill] { flex: 1 1 0; }
&__lead { flex: 1 1 8rem; min-width: 0; }`;

/** A filled slot's elements, each drawn under its own class; their CSS goes to `css`. */
const slotItems = (
  slot: ConceptSlot,
  prefix: string,
  draw: Draw,
  css: string[],
  lead = ""
): string => {
  const children = slot.elements.map((child, index) => {
    const drawn = draw(child, `${prefix}-${index + 1}`);
    css.push(drawn.css);
    return indent(drawn.jsx);
  });
  return `<div className="@@__items" data-layout="${slot.layout ?? "column"}"${slot.fill ? " data-fill" : ""} style=${itemsStyle(slot)}>\n${[lead, ...children].filter(Boolean).join("\n")}\n</div>`;
};

/** Header, body and footer, each laid out its own way, the lead first. */
const slotsOf = (
  element: ReviewConceptElement,
  cls: string,
  draw: Draw,
  lead: string,
  headerEnd = ""
): { css: string; jsx: string } => {
  const css: string[] = [];
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: each slot contributes optional lead, contents and close control in order
  const slots = LAYOUT_SLOTS.map((name: ConceptSlotName) => {
    const slot = element.slots?.[name];
    const filled = slot?.elements.length ? slot : undefined;
    const led = name === "header" && lead;
    const end = name === "header" ? headerEnd : "";
    if (
      !(
        led ||
        filled ||
        end ||
        slot?.flex ||
        (element.kind === "navbar" && name === "body")
      )
    ) {
      return "";
    }
    const defaultStyle = end ? ' style={{ padding: "8px" }}' : "";
    const style = slot
      ? ` style={{ ${slot.flex ? `flex: "${flexSize(slot.flex)}", ` : ""}gap: ${slot.gap ?? SLOT_DEFAULTS.gap}, padding: "${slot.paddingY ?? SLOT_DEFAULTS.paddingY}px ${slot.paddingX ?? SLOT_DEFAULTS.paddingX}px" }}`
      : defaultStyle;
    const titleInLayout = element.kind === "panel" && Boolean(led);
    const items =
      filled || titleInLayout
        ? slotItems(
            slot ?? { elements: [] },
            `${cls}__${name}`,
            draw,
            css,
            titleInLayout ? lead : ""
          )
        : "";
    const inner = [led && !titleInLayout ? lead : "", items, end]
      .filter(Boolean)
      .join("\n");
    return `<div className="@@__slot" data-slot="${name}"${(led && !titleInLayout) || end ? " data-led" : ""}${end ? " data-close" : ""}${style}>\n${indent(inner)}\n</div>`;
  }).filter(Boolean);
  return {
    css: css.join("\n"),
    jsx: `<div className="@@__slots"${element.dividers ? " data-dividers" : ""}>\n${indent(slots.join("\n"))}\n</div>`,
  };
};

/** A group: its elements laid out as a slot lays out its own. */
export const groupMarkup = (el: ReviewConceptElement, draw: Draw): Markup => {
  const group = el.group ?? { elements: [] };
  const css: string[] = [];
  const items = slotItems(group, "@@__item", draw, css);
  return {
    body: items,
    childCss: css.join("\n"),
    css: `& { display: flex; min-width: 0;${group.full ? " width: 100%; align-self: stretch;" : ""} }
& > &__items { flex: 1 1 auto; }
${SLOTS_CSS}`,
    tag: "div",
    tokens: [
      [
        "padding",
        `${group.paddingY ?? SLOT_DEFAULTS.paddingY}px ${group.paddingX ?? SLOT_DEFAULTS.paddingX}px`,
      ],
    ],
  };
};

export const cardMarkup = (el: ReviewConceptElement, draw: Draw): Markup => {
  const { body, title } = splitCardText(el.text);
  const icon = svgJsx(el);
  const lead = [
    '<div className="@@__lead @@__text">',
    ...(icon ? [indent(icon)] : []),
    ...(title.trim()
      ? ['  <strong className="@@__title">{title}</strong>']
      : []),
    ...(body.trim() ? ['  <p className="@@__body">{children}</p>'] : []),
    "</div>",
  ].join("\n");
  return {
    css: `& { display: grid; gap: 6px; align-content: start; width: 100%; min-width: 0; }
${HOVER_CSS}
&__text { display: grid; gap: 6px; align-content: start; }
&__icon { color: var(--&-icon-color, currentColor); }
&__title { font-weight: var(--&-title-weight, bolder); }
&__body { margin: 0; white-space: pre-line; opacity: 0.8; font-size: var(--&-body-size, inherit); }
${SLOTS_CSS}`,
    props: "title",
    tag: "article",
    ...withSlots(el, draw, lead),
  };
};

export const panelMarkup = (el: ReviewConceptElement, draw: Draw): Markup => {
  const controls = panelHandleElements(el).map((child, i) =>
    draw(child, `@@__hide-${i + 1}`)
  );
  const slotted = withSlots(
    el,
    draw,
    el.text ? `<strong className="@@__lead">${escapeJsx(el.text)}</strong>` : ""
  );
  const label = JSON.stringify(el.text || "Panel");
  const handle =
    controls.map((child) => child.jsx).join("\n") ||
    '<span className="@@__chevron">‹</span>';
  const hasTrigger = controls.length > 0 || el.panelCollapsed;
  const surface = `<div className="@@__surface">\n${slotted.body}\n</div>`;
  const control = (trigger: string) =>
    hasTrigger
      ? `<div className="@@__hide">\n${trigger}<div inert aria-hidden="true">${handle}</div>\n</div>`
      : "";
  return {
    attrs: `aria-label=${label} data-toggle-side="${el.panelToggleSide ?? "right"}"`,
    body: [
      `<div className="@@__inner" data-panel-open="${!el.panelCollapsed}">${surface}</div>`,
      control(
        `<button type="button" className="@@__trigger" aria-label=${JSON.stringify(`Toggle ${el.text || "panel"}`)} aria-expanded={${!el.panelCollapsed}} />`
      ),
    ].join("\n"),
    childCss: [slotted.childCss, ...controls.map((h) => h.css)]
      .filter(Boolean)
      .join("\n"),
    css: `& { display: flex; align-items: flex-start; width: 100%; min-width: 0; background: transparent; border: 0; padding: 0; box-shadow: none; }
&[data-toggle-side="left"] { flex-direction: row-reverse; }
&[data-toggle-side="left"] > &__hide :is(svg:first-of-type, &__chevron) { scale: -1 1; }
&__surface { box-sizing: border-box; width: 100%; min-width: 0; background: var(--&-background); padding: var(--&-padding); border: var(--&-border); border-radius: var(--&-radius); box-shadow: var(--&-shadow); }
&__inner { width: 100%; min-width: 0; transition: width 260ms ease, overflow 0s 260ms allow-discrete; }
&__inner[data-starting-style], &__inner[data-ending-style], &__inner[data-panel-open="false"] { width: 0; overflow: clip; transition-delay: 0s; }
&__hide { display: flex; position: relative; flex: none; }
&__hide > [inert] { display: flex; }
&__trigger { position: absolute; inset: 0; z-index: 1; background: transparent; border: 0; cursor: pointer; }
&__trigger[aria-expanded="false"] + [inert] svg:first-of-type, &__trigger[aria-expanded="false"] + [inert] &__chevron { rotate: 180deg; }
&__trigger:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { &__inner { transition: none; } }
${SLOTS_CSS}
&__items:not([data-layout="row"]) > &__lead { flex: none; }`,
    tag: "section",
    tsx: (
      name,
      cls
    ) => `import { Collapsible } from "@base-ui/react/collapsible";
import "./${name}.css";

type ${name}Props = Pick<Collapsible.Root.Props, "open" | "defaultOpen" | "onOpenChange"> & { className?: string; toggleSide?: "left" | "right" };

export function ${name}({ className, toggleSide = "${el.panelToggleSide ?? "right"}", defaultOpen = ${!el.panelCollapsed}, ...props }: ${name}Props) {
  return (
    <Collapsible.Root {...props} defaultOpen={defaultOpen} data-toggle-side={toggleSide} aria-label=${label} className={[${JSON.stringify(cls)}, className].filter(Boolean).join(" ")}>
      <Collapsible.Panel className="${cls}__inner">
        ${surface.replaceAll("@@", cls)}
      </Collapsible.Panel>
      ${control(`<Collapsible.Trigger className="@@__trigger" aria-label=${JSON.stringify(`Toggle ${el.text || "panel"}`)} />`).replaceAll("@@", cls)}
    </Collapsible.Root>
  );
}
`,
  };
};

/** A navbar: start, middle and end in one row, the middle taking the rest. */
export const navbarMarkup = (el: ReviewConceptElement, draw: Draw): Markup => {
  const slotted = withSlots(el, draw, "");
  return {
    attrs: 'aria-label="Navigation"',
    body: slotted.body,
    childCss: slotted.childCss,
    css: `& { display: block; width: 100%; }
${SLOTS_CSS}
&__slots { flex-direction: row; align-items: center; }
&__slots:not([data-dividers]) { gap: 0; }
&__slot { flex: 0 0 auto; }
&__slot[data-slot="body"] { flex: 1 1 auto; }`,
    tag: "nav",
  };
};

/** A logo: the brand's mark at its height, its width following the picture. */
export const logoMarkup = (el: ReviewConceptElement): Markup => ({
  attrs: `src=${JSON.stringify(el.logoUrl ?? "")} alt="Logo"`,
  css: `& { display: block; height: ${el.logoHeight ?? 32}px; width: auto; max-width: 100%; object-fit: contain; }`,
  tag: "img",
});

/** The slots' body and their children's CSS; the class is filled in later. */
const withSlots = (
  el: ReviewConceptElement,
  draw: Draw,
  lead: string,
  headerEnd = ""
): Pick<Markup, "body" | "childCss"> => {
  // The children's classes need the block's class now; "@@" holds its place
  // in this element's own markup and is resolved with the rest.
  const placeholder = "@@";
  const drawn = slotsOf(el, placeholder, draw, lead, headerEnd);
  return { body: drawn.jsx, childCss: drawn.css };
};

const tabsCss = `& { position: relative; display: flex; align-items: stretch; min-height: var(--&-tab-height, auto); border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
&__tab { position: relative; display: flex; flex-shrink: 0; align-items: center; padding: 0 var(--&-tab-padding-x, 0); font: inherit; color: var(--&-tab-inactive, currentColor); white-space: nowrap; cursor: pointer; background: none; border: 0; }
&__tab[aria-current="page"] { color: var(--&-tab-active, currentColor); }
&__tab[aria-current="page"]::after { content: ""; position: absolute; right: 0; bottom: -1px; left: 0; height: var(--&-tab-indicator-size, 2px); background: var(--&-tab-indicator, currentColor); }
&__tab:not([aria-current]):hover { color: var(--&-tab-hover, var(--&-tab-active, currentColor)); }
&__tab:focus-visible { outline: 2px solid var(--&-tab-indicator, currentColor); outline-offset: -2px; }`;

export const tabsMarkup = (el: ReviewConceptElement): Markup => {
  const tabs = el.options?.length ? el.options : [el.text || "Overview"];
  const active = tabs.includes(el.text) ? el.text : tabs[0];
  const look = el.tabLook;
  const px = (n?: number) => (n === undefined ? undefined : `${n}px`);
  const tokens = (
    [
      ["padding", `${el.paddingY}px ${look?.rowPaddingX ?? 0}px`],
      ["tab-padding-x", `${el.paddingX}px`],
      ["tab-height", px(look?.height)],
      ["tab-active", look?.activeColor],
      ["tab-inactive", look?.inactiveColor],
      ["tab-indicator", look?.indicatorColor],
      ["tab-indicator-size", px(look?.indicatorSize)],
      ["tab-hover", el.hover?.color],
    ] as [string, string | undefined][]
  ).filter((t): t is [string, string] => t[1] !== undefined);
  return {
    attrs: 'aria-label="Tabs"',
    body: tabs
      .map(
        (tab) =>
          `<button className="@@__tab" type="button"${tab === active ? ' aria-current="page"' : ""}>${escapeJsx(tab)}</button>`
      )
      .join("\n"),
    css: tabsCss,
    tag: "nav",
    tokens,
    tsx: (name, cls) => `import { useState } from "react";
import "./${name}.css";

interface ${name}Props {
  className?: string;
  onChange?: (tab: string) => void;
  tabs?: string[];
  value?: string;
}

/** Tabs from the brand kit: the open one is marked, and a click moves it. */
export function ${name}({
  className,
  onChange,
  tabs = ${JSON.stringify(tabs)},
  value = ${JSON.stringify(active)},
}: ${name}Props) {
  const [open, setOpen] = useState(value);
  return (
    <nav aria-label="Tabs" className={className ? \`${cls} \${className}\` : "${cls}"}>
      {tabs.map((tab) => (
        <button
          aria-current={tab === open ? "page" : undefined}
          className="${cls}__tab"
          key={tab}
          onClick={() => {
            setOpen(tab);
            onChange?.(tab);
          }}
          type="button"
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}
`,
  };
};

export const progressMarkup = (el: ReviewConceptElement): Markup => {
  const value = Math.round(el.progress ?? 60);
  const showValue = el.showValue !== false;
  const label =
    el.text || showValue
      ? `<span className="@@__label">\n  <span>${escapeJsx(el.text)}</span>${showValue ? `\n  <span>${value}%</span>` : ""}\n</span>\n`
      : "";
  return {
    body: `${label}<span className="@@__track" role="progressbar" aria-label=${JSON.stringify(el.text || `${value}%`)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={${value}}>\n  <span className="@@__fill" style={{ inlineSize: "${value}%" }} />\n</span>`,
    // The element's fill is the track; the box around them stays clear.
    css: `& { display: flex; flex-direction: column; gap: 0.5em; width: 100%; min-width: 8rem; background: transparent; border-radius: 0; }
&__label { display: flex; gap: 1em; justify-content: space-between; }
&__label > span:last-child { font-variant-numeric: tabular-nums; }
&__track { display: block; inline-size: 100%; min-inline-size: 3rem; block-size: var(--&-bar-height, 6px); overflow: hidden; background: var(--&-background); border-radius: var(--&-radius); }
&__fill { display: block; block-size: 100%; background: var(--&-accent, currentColor); border-radius: inherit; }`,
    tag: "div",
  };
};

export const checkboxMarkup = (el: ReviewConceptElement): Markup => ({
  body: `<input type="checkbox"${el.checked ? " defaultChecked" : ""} />\n{children}`,
  css: "& { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }\n& > input { accent-color: var(--&-accent); inline-size: var(--&-check-size, 1em); block-size: var(--&-check-size, 1em); margin: 0; }",
  tag: "label",
});
