import { escapeJsx, iconSvgJsx, type Markup } from "./componentSourceParts.js";
import { iconSizeOf } from "./conceptKinds.js";
import { shadowCss, shadowOf } from "./conceptShadow.js";
import type { ReviewConceptElement } from "./reviewConcept.js";

/**
 * The kinds componentSource draws as more than their own box, each as the
 * app draws it (src/components/review: ConceptIcon, ReviewConceptElementView,
 * ConceptToastPreview), so the docs preview and the copied code match the
 * kit: a button's or badge's icons, an input's leading icon, a select
 * showing its value, a menu's trigger, a dialog's text and actions, a
 * toast's action and close.
 *
 * In a body, `@@` stands for the block's class; in CSS, `&` does.
 */

const quote = (value: string): string => JSON.stringify(value);

const ICON_LABELS: Record<string, string> = {
  Cancel01Icon: "Close",
  Cancel02Icon: "Close",
  MultiplicationSignIcon: "Close",
};
const ICON_SUFFIX = /Icon$/;
const CAMEL = /([a-z])([A-Z0-9])/g;
const TRAILING_NUMBER = /\s*\d+$/;

/** What an icon-only control is called, from its icon: "Close", "Search". */
export const iconLabelOf = (name: string | undefined): string =>
  (name &&
    (ICON_LABELS[name] ??
      name
        .replace(ICON_SUFFIX, "")
        .replace(CAMEL, "$1 $2")
        .replace(TRAILING_NUMBER, ""))) ||
  "Icon";

/** A chevron pointing down, drawn in currentColor. */
const CHEVRON = (cls: string, size: number) =>
  `<svg className="${cls}" width={${size}} height={${size}} viewBox="0 0 24 24" fill="none" aria-hidden="true">\n  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />\n</svg>`;

/** No shadow set on the element: the kind's own soft one is used. */
const ownShadow = (el: ReviewConceptElement, fallback: string): string =>
  shadowCss(shadowOf(el)) === "none" ? `& { box-shadow: ${fallback}; }` : "";

/**
 * A button, badge or tag with its icons: the start icon, the label, the end
 * icon. With no label it is an icon button, named by its icon. Without
 * icons it is left as it was.
 */
export const withIcons = (el: ReviewConceptElement, base: Markup): Markup => {
  const size = iconSizeOf(el);
  const start = iconSvgJsx(el.iconSvg, size);
  const end = iconSvgJsx(el.iconEndSvg, size);
  if (!(start || end)) {
    return base;
  }
  const text = el.text.trim();
  const label = text
    ? ""
    : `aria-label=${quote(iconLabelOf(el.iconName ?? el.iconEndName))}`;
  return {
    ...base,
    attrs: [base.attrs, label].filter(Boolean).join(" "),
    body: [start, text ? "<span>{children}</span>" : "", end]
      .filter(Boolean)
      .join("\n"),
    css: [
      base.css,
      `& { display: inline-flex; align-items: center; justify-content: center; gap: ${Math.round(el.fontSize * 0.4)}px; flex-shrink: 0; white-space: nowrap; }`,
      "&__icon { flex: none; color: var(--&-icon-color, currentColor); }",
      text ? "" : `& { padding: ${el.paddingY}px; }`,
    ]
      .filter(Boolean)
      .join("\n"),
    passChildren: false,
  };
};

const FIELD_CSS = `&__field { all: unset; flex: 1; min-width: 0; font: inherit; color: inherit; }
&__field::placeholder { color: inherit; opacity: 0.6; }
&:focus-within { outline: 2px solid var(--&-accent, currentColor); outline-offset: 2px; }`;

/** An input, with its leading icon inside the box when it has one. */
export const inputMarkup = (
  el: ReviewConceptElement,
  focus: string
): Markup => {
  const type = quote(el.inputType ?? "text");
  const placeholder = quote(el.placeholder ?? "");
  const icon = iconSvgJsx(el.iconSvg, iconSizeOf(el));
  if (!icon) {
    return {
      attrs: `type=${type} placeholder=${placeholder}`,
      css: focus,
      tag: "input",
    };
  }
  return {
    body: `${icon}\n<input className="@@__field" type=${type} placeholder=${placeholder} aria-label=${quote(el.placeholder || "Search")} />`,
    css: `& { display: inline-flex; align-items: center; gap: ${Math.round(el.fontSize * 0.5)}px; cursor: text; }
&__icon { flex: none; color: var(--&-icon-color, currentColor); }
${FIELD_CSS}`,
    tag: "label",
  };
};

/**
 * A select showing its text as the chosen value, as the app does, with a
 * chevron of its own in place of the browser's, in the element's colour.
 */
export const selectMarkup = (
  el: ReviewConceptElement,
  focus: string
): Markup => {
  const shown = el.text.trim() || el.options?.[0] || "Choose";
  const options = [shown, ...(el.options ?? []).filter((o) => o !== shown)];
  const chevron = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${el.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`
  );
  return {
    attrs: `aria-label=${quote(el.placeholder || shown)} defaultValue=${quote(shown)}`,
    body: options.map((o) => `<option>${escapeJsx(o)}</option>`).join("\n"),
    css: `& { appearance: none; -webkit-appearance: none; padding-inline-end: calc(1em + 20px); cursor: pointer; background-image: url("data:image/svg+xml,${chevron}"); background-repeat: no-repeat; background-position: right 10px center; background-size: 1em; }
${focus}`,
    tag: "select",
  };
};

/**
 * A dropdown menu, closed, as the app shows it: a trigger in the element's
 * look with a chevron, and its options in a list that opens below. A
 * <details> opens it with no script; the project adopting it can swap in
 * its own menu.
 */
export const menuMarkup = (el: ReviewConceptElement): Markup => {
  // A list opens over whatever is below, so it is never see-through.
  const fill = el.menuLook?.background ?? el.background;
  const menuBg = !fill || fill === "transparent" ? "#ffffff" : fill;
  const items = (el.options?.length ? el.options : [el.text || "Option"])
    .map(
      (o) =>
        `  <button className="@@__item" role="menuitem" type="button">${escapeJsx(o)}</button>`
    )
    .join("\n");
  return {
    body: `<summary className="@@__trigger">{children}\n  ${CHEVRON("@@__chevron", el.fontSize).split("\n").join("\n  ")}\n</summary>\n<div className="@@__list" role="menu">\n${items}\n</div>`,
    css: `& { position: relative; display: inline-block; padding: 0; }
&__trigger { display: inline-flex; align-items: center; gap: ${Math.round(el.fontSize * 0.4)}px; padding: var(--&-padding); cursor: pointer; list-style: none; }
&__trigger::-webkit-details-marker { display: none; }
&[open] > &__trigger, &__trigger:focus-visible { outline: 2px solid var(--&-accent, currentColor); outline-offset: 2px; }
&__list { position: absolute; z-index: 10; top: calc(100% + 4px); left: 0; display: grid; min-width: 100%; padding: 4px; background: ${menuBg}; color: var(--&-color); border: 1px solid color-mix(in srgb, var(--&-color) 15%, transparent); border-radius: var(--&-radius); box-shadow: 0 8px 24px color-mix(in srgb, #000 16%, transparent); }
&__item { all: unset; padding: 6px 10px; border-radius: calc(var(--&-radius) - 2px); cursor: pointer; white-space: nowrap; }
&__item:hover, &__item:focus-visible { background: color-mix(in srgb, var(--&-color) 10%, transparent); }`,
    tag: "details",
  };
};

/** A dialog's title, its line of detail and its actions, raised off the page. */
export const dialogMarkup = (
  el: ReviewConceptElement,
  title: string
): Markup => ({
  attrs: `role="dialog" aria-modal="true" aria-label=${quote(title)}`,
  body: `<strong className="@@__title">{children}</strong>
<p className="@@__body">Supporting details and a clear next step.</p>
<div className="@@__actions">
  <button type="button">Cancel</button>
  <button type="button">Confirm</button>
</div>`,
  css: [
    "& { display: grid; gap: 12px; width: min(100%, 24rem); }",
    ownShadow(el, "0 12px 32px color-mix(in srgb, #000 20%, transparent)"),
    "&__body { margin: 0; }",
    "&__actions { display: flex; gap: 8px; justify-content: end; }",
    "&__actions > button { padding: 0; font: inherit; color: inherit; cursor: pointer; background: none; border: 0; }",
  ]
    .filter(Boolean)
    .join("\n"),
  tag: "div",
});

/** A toast: its message, its action in the action colour, and a close. */
export const toastMarkup = (el: ReviewConceptElement): Markup => {
  const action = el.toastAction?.trim();
  return {
    attrs: 'role="status"',
    body: [
      '<span className="@@__text">{children}</span>',
      action
        ? `<button className="@@__action" type="button">${escapeJsx(action)}</button>`
        : "",
      el.toastClose === false
        ? ""
        : `<button className="@@__close" type="button" aria-label="Close">\n  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden="true">\n    <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />\n  </svg>\n</button>`,
    ]
      .filter(Boolean)
      .join("\n"),
    css: [
      "& { display: flex; gap: 0.75em; align-items: center; width: fit-content; max-width: 100%; }",
      ownShadow(el, "0 6px 18px color-mix(in srgb, #000 16%, transparent)"),
      "&__text { flex: 1; min-width: 0; }",
      "&__action, &__close { padding: 0; font: inherit; color: inherit; cursor: pointer; background: none; border: 0; }",
      "&__action { font-weight: 600; color: var(--&-accent, inherit); }",
      "&__close { display: inline-flex; opacity: 0.6; }",
    ]
      .filter(Boolean)
      .join("\n"),
    tag: "div",
  };
};
