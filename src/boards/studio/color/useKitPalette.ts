import { useState } from "react";
import { toast } from "sonner";
import type { BrandKitDoc, PaletteEntry } from "../../../../config/brandKit.js";
import { useBrandKits } from "../../../hooks/useBrandKits";
import { brandKitsApi } from "../../../services/brandKitService";
import { useActiveBrand } from "../../brand/ActiveBrand";

/**
 * The active brand's palette, and saving a new one (or any other part of
 * the kit, via `update`) over it.
 *
 * A save is a new kit version, so the old palette is one restore away in the
 * kit's history. Colours that were already in the palette keep their names
 * and roles; new ones come in unnamed, to be named on the kit page.
 */
export const useKitPalette = () => {
  const brand = useActiveBrand();
  const { refresh } = useBrandKits();
  const [saving, setSaving] = useState(false);
  const kit = brand?.kit ?? null;
  const entries: PaletteEntry[] = kit?.resolvedDoc.palette ?? [];

  /** Saves part of the kit as a new version; `what` names it in the toast. */
  const update = async (patch: Partial<BrandKitDoc>, what: string) => {
    if (!kit) {
      return;
    }
    setSaving(true);
    try {
      await brandKitsApi.save(kit.id, { ...kit.doc, ...patch });
      await refresh();
      toast.success(`Saved as ${kit.name}'s ${what}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Couldn't save the ${what}`);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Saves a palette over the kit's. A colour already in the palette keeps
   * its name and role. With `byPlace` (the entries the values were loaded
   * from, in order), an edited colour keeps the name and role of the one
   * that was in its place, so changing a brand colour doesn't unname it.
   */
  const save = (values: string[], byPlace?: PaletteEntry[] | null) =>
    update(
      {
        palette: values.map((raw, i) => {
          const value = raw.toLowerCase();
          const was =
            byPlace?.[i] ?? entries.find((e) => e.value === value) ?? null;
          return { name: was?.name ?? "", role: was?.role ?? "", value };
        }),
      },
      "palette"
    );

  return { entries, kit, save, saving, update };
};
