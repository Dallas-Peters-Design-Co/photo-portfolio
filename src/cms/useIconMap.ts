import { useEffect, useState } from "react";
import type { IconComponent } from "./iconMap";

type IconMap = Record<string, IconComponent>;

let cached: IconMap | null = null;
let pending: Promise<IconMap> | null = null;

const loadIconMap = (): Promise<IconMap> => {
  pending ??= import("./iconMap").then((m) => {
    cached = m.ICON_COMPONENTS;
    return cached;
  });
  return pending;
};

/**
 * The icon map, loaded on demand so it stays out of the entry bundle.
 *
 * Returns null on the first render of the first page that needs it, then the
 * map once its chunk has arrived; every later caller gets it synchronously.
 * Callers that need no icons pass `false` and nothing is fetched.
 */
export const useIconMap = (needed = true): IconMap | null => {
  const [map, setMap] = useState<IconMap | null>(cached);
  useEffect(() => {
    if (!needed || map) {
      return;
    }
    let live = true;
    loadIconMap()
      .then((m) => live && setMap(m))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [needed, map]);
  return map;
};

/** Looks a stored icon name up in a loaded map. */
export const iconFrom = (
  map: IconMap | null,
  name: string | null | undefined
): IconComponent | null => (map && name ? (map[name] ?? null) : null);
