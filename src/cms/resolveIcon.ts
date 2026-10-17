import { ICON_COMPONENTS, type IconComponent } from "./iconMap";

/**
 * Resolves an icon's drawing data by name, since the icon is stored as free
 * text in the database and may not match anything in the pack.
 *
 * This pulls in the whole icon map (about 160 KB), so only admin code imports
 * it directly. Public pages go through `useIconMap`, which loads the map in its
 * own chunk after the page has rendered.
 */
export const resolveIcon = (
  name: string | null | undefined
): IconComponent | null => {
  if (!name) {
    return null;
  }
  return ICON_COMPONENTS[name] ?? null;
};
