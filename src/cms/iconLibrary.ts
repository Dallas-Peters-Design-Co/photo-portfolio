import type { IconSvgElement } from "@hugeicons/react";
import { useEffect, useState } from "react";

/**
 * The whole Hugeicons stroke set, about 6,000 icons, for the admin's
 * full-library picker. One chunk of ~900 KB gzipped, fetched the first time
 * someone searches it and never by a public page: whatever is chosen is saved
 * with its drawing (see ConceptIconSvg), so nothing downstream needs this.
 */
export interface IconLibrary {
  icons: Record<string, IconSvgElement>;
  /** Every icon once, sorted; the pack also exports aliases of each. */
  names: string[];
}

const ALIAS_SUFFIX = /StrokeStandard$/;

let pending: Promise<IconLibrary> | null = null;

const loadIconLibrary = (): Promise<IconLibrary> => {
  pending ??= import("@hugeicons-pro/core-stroke-standard").then((pack) => {
    const icons: Record<string, IconSvgElement> = {};
    const seen = new Set<IconSvgElement>();
    for (const [name, icon] of Object.entries(pack)) {
      const isIcon =
        name.endsWith("Icon") &&
        !ALIAS_SUFFIX.test(name) &&
        Array.isArray(icon);
      if (isIcon && !seen.has(icon as IconSvgElement)) {
        seen.add(icon as IconSvgElement);
        icons[name] = icon as IconSvgElement;
      }
    }
    return { icons, names: Object.keys(icons).sort() };
  });
  return pending;
};

/** The library once `wanted` is true; null while it loads or before. */
export const useIconLibrary = (wanted: boolean): IconLibrary | null => {
  const [library, setLibrary] = useState<IconLibrary | null>(null);
  useEffect(() => {
    if (!wanted || library) {
      return;
    }
    let live = true;
    loadIconLibrary()
      .then((loaded) => live && setLibrary(loaded))
      .catch(() => {
        // A failed chunk load: drop it so the next search tries again.
        pending = null;
      });
    return () => {
      live = false;
    };
  }, [wanted, library]);
  return library;
};
