import type { IconSvgElement } from "@hugeicons/react";
import { useEffect, useState } from "react";

/** The active full-library pack loads on demand. Published concepts carry the selected drawing. */
export interface IconLibrary {
  icons: Record<string, IconSvgElement>;
  /** Every icon once, sorted; the pack also exports aliases of each. */
  names: string[];
}

export type IconSet = "stroke" | "filled";

const pending = new Map<IconSet, Promise<IconLibrary>>();

function loadIconLibrary(set: IconSet): Promise<IconLibrary> {
  const existing = pending.get(set);
  if (existing) {
    return existing;
  }
  const pack =
    set === "filled"
      ? import("@hugeicons-pro/core-solid-standard")
      : import("@hugeicons-pro/core-stroke-standard");
  const request = pack
    .then((exports) => {
      const icons: Record<string, IconSvgElement> = {};
      const names: string[] = [];
      const seen = new Set<IconSvgElement>();
      for (const [name, icon] of Object.entries(exports)) {
        if (!(name.endsWith("Icon") && Array.isArray(icon))) {
          continue;
        }
        icons[name] = icon as IconSvgElement;
        if (!seen.has(icon as IconSvgElement)) {
          names.push(name);
          seen.add(icon as IconSvgElement);
        }
      }
      return { icons, names: names.sort() };
    })
    .catch((error: unknown) => {
      pending.delete(set);
      throw error;
    });
  pending.set(set, request);
  return request;
}

export function useIconLibrary(
  wanted: boolean,
  set: IconSet
): IconLibrary | null {
  const [loaded, setLoaded] = useState<{
    set: IconSet;
    library: IconLibrary;
  } | null>(null);
  useEffect(() => {
    if (!wanted || loaded?.set === set) {
      return;
    }
    let live = true;
    loadIconLibrary(set)
      .then((library) => {
        if (live) {
          setLoaded({ library, set });
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [wanted, set, loaded]);
  return loaded?.set === set ? loaded.library : null;
}
