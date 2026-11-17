/**
 * The docs site (docs/site, published by Mintlify), where each brand kit with
 * component styles gets a design system page (scripts/docs-components.mjs).
 * Only the dallas-images site publishes there.
 */

export const DOCS_ORIGIN = "https://docs.dallaspeters.com";
export const DOCS_SITE_KEY = "dallas-images";

const WORD = /[a-z0-9]+/g;

/** A kit's page name on the docs site, from its name. */
export const docsSlugOf = (name: string): string =>
  name.toLowerCase().match(WORD)?.join("-") || "brand";

/** The kit's design system page. */
export const designSystemUrl = (kitName: string): string =>
  `${DOCS_ORIGIN}/components/${docsSlugOf(kitName)}`;
