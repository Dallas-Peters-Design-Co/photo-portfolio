import {
  type ComponentSource,
  componentSource,
} from "../../config/componentSource.js";
import { withIconDrawings } from "../../config/componentSourceParts.js";
import { styleSample } from "../../config/conceptDefaults.js";
import type { ConceptIconSvg } from "../../config/conceptIcon.js";
import { applyColumnStyles } from "../../config/conceptStyle.js";
import { docsSlugOf } from "../../config/docsSite.js";
import {
  adobeFontCss,
  fontshareFontCss,
  googleFontCss,
  parseFontRef,
} from "../../config/fontRef.js";
import { jsxToHtml } from "../../config/jsxToHtml.js";
import type { ReviewConceptElement } from "../../config/reviewConcept.js";
import { ICON_COMPONENTS } from "../../src/cms/iconMap.js";
import { loadKits } from "./brandKitStore.js";
import type { getSql } from "./db.js";

/**
 * The docs site's feed: every brand kit that has component styles of its
 * own, each style as the React and CSS a kit's Copy button gives.
 *
 * Public, unlike the rest of `/api/brand-kits`, because it is what the
 * public docs publish (scripts/docs-components.mjs turns it into pages). It
 * carries only the component styles — not the kit's voice, notes, logos or
 * references — and a kit without styles is not listed at all.
 */

export interface ComponentDocsKit {
  components: {
    id: string;
    kind: string;
    /** The preview as plain HTML, for the docs script's accessibility scan. */
    html: string;
    name: string;
    source: ComponentSource;
  }[];
  /** Stylesheets for the brand typefaces the components use. */
  fonts: string[];
  name: string;
  /** The page's file name: the kit's name in lower-case words. */
  slug: string;
  updatedAt: string;
}

const slugOf = docsSlugOf;

/** The site's icon set, by name: what the app draws a named icon with. */
const iconDrawing = (name: string): ConceptIconSvg | undefined =>
  ICON_COMPONENTS[name] as unknown as ConceptIconSvg | undefined;

/** The stylesheet that serves an element's brand typeface, if it has one. */
const fontCssOf = (element: ReviewConceptElement): string | null => {
  const ref =
    element.fontFamily === "brand" ? parseFontRef(element.fontRef) : null;
  if (ref?.source === "google") {
    return googleFontCss(ref.family);
  }
  if (ref?.source === "fontshare" && ref.slug) {
    return fontshareFontCss(ref.slug);
  }
  if (ref?.source === "adobe" && ref.kitId) {
    return adobeFontCss(ref.kitId);
  }
  return null;
};

export const componentDocs = async (
  sql: ReturnType<typeof getSql>
): Promise<ComponentDocsKit[]> => {
  const kits = await loadKits(sql);
  const taken = new Set<string>();
  // A kit following another's components gets its own page, drawn in its
  // colours; a sub-brand merely inheriting its parent's doesn't.
  const ownOrLinked = (kit: (typeof kits)[number]) =>
    kit.doc.componentStyles.length > 0 || kit.doc.componentsFrom
      ? kit.resolvedDoc.componentStyles
      : [];
  return kits
    .filter((kit) => ownOrLinked(kit).length > 0)
    .map((kit) => {
      // Two kits with one name still get a page each.
      let slug = slugOf(kit.name);
      while (taken.has(slug)) {
        slug = `${slug}-${kit.id.slice(0, 4)}`;
      }
      taken.add(slug);
      // Two styles of one kind and name would share a class; the later
      // one is numbered.
      const classes = new Set<string>();
      const fonts = new Set<string>();
      const components = ownOrLinked(kit).map((style) => {
        // A table's tag, chip and button columns in the kit's own styles.
        const sample = withIconDrawings(
          applyColumnStyles(
            styleSample(style, kit.resolvedDoc),
            kit.resolvedDoc.componentStyles
          ),
          iconDrawing
        );
        const font = fontCssOf(sample);
        if (font) {
          fonts.add(font);
        }
        let { name } = style;
        let source = componentSource(sample, name);
        for (let n = 2; classes.has(source.className); n += 1) {
          name = `${style.name} ${n}`;
          source = componentSource(sample, name);
        }
        classes.add(source.className);
        return {
          html: jsxToHtml(source.preview),
          id: style.id,
          kind: style.kind,
          name,
          source,
        };
      });
      return {
        components,
        fonts: [...fonts],
        name: kit.name,
        slug,
        updatedAt: kit.updatedAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};
