import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { toast } from "sonner";
import {
  type ConceptStyle,
  MAX_CONCEPT_STYLES,
} from "../../../config/conceptStyle.js";
import { useBrandKits } from "../../hooks/useBrandKits";
import { brandKitsApi } from "../../services/brandKitService";

/**
 * Saving a component style from a review back into its brand kit: a style
 * changed in a concept updates the kit's style, or becomes a new one.
 *
 * Saved as a new version of the kit, so the kit's history can undo it. A
 * sub-brand using its parent's styles takes them as its own first (what
 * "Make them this brand's" does in the kit), so the parent is never changed
 * from one of its sub-brands' reviews.
 */

export interface KitStyleSync {
  kitId?: string;
  kitName: string;
  /** Writes the style into the kit: replacing one with its id, else added. */
  save: (style: ConceptStyle) => Promise<boolean>;
}

export const KitStyleSyncContext = createContext<KitStyleSync | null>(null);

/** What a concept field uses; null when the review has no brand kit. */
export const useKitStyleSync = () => useContext(KitStyleSyncContext);

export function KitStyleSyncProvider({
  children,
  kitId,
}: {
  children: ReactNode;
  kitId: string | null;
}) {
  const { kits, refresh } = useBrandKits();
  const kit = kits.find((k) => k.id === kitId) ?? null;
  const save = useCallback(
    async (style: ConceptStyle): Promise<boolean> => {
      if (!kit) {
        return false;
      }
      const own = kit.doc.componentStyles;
      const base = own.length > 0 ? own : kit.resolvedDoc.componentStyles;
      const exists = base.some((s) => s.id === style.id);
      if (!exists && base.length >= MAX_CONCEPT_STYLES) {
        toast.error(`${kit.name} holds the most styles it can.`);
        return false;
      }
      const componentStyles = exists
        ? base.map((s) => (s.id === style.id ? style : s))
        : [...base, style];
      try {
        await brandKitsApi.save(kit.id, {
          ...kit.doc,
          componentStyles,
        });
        await refresh();
        toast.success(
          exists
            ? `${style.name} updated in ${kit.name}. Every review using it follows.`
            : `${style.name} added to ${kit.name}.`
        );
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't save to the kit"
        );
        return false;
      }
    },
    [kit, refresh]
  );
  const value = useMemo<KitStyleSync | null>(
    () => (kit ? { kitId: kit.id, kitName: kit.name, save } : null),
    [kit, save]
  );
  return (
    <KitStyleSyncContext.Provider value={value}>
      {children}
    </KitStyleSyncContext.Provider>
  );
}
