import { useState } from "react";
import { toast } from "sonner";
import type { PaletteEntry } from "../../../../config/brandKit.js";
import { useBrandKits } from "../../../hooks/useBrandKits";
import { brandKitsApi } from "../../../services/brandKitService";
import { useActiveBrand } from "../../brand/ActiveBrand";

/**
 * The active brand's palette, and saving a new one over it.
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

  const save = async (values: string[]) => {
    if (!kit) {
      return;
    }
    setSaving(true);
    try {
      const palette = values.map(
        (value) =>
          entries.find((e) => e.value === value.toLowerCase()) ?? {
            name: "",
            role: "",
            value: value.toLowerCase(),
          }
      );
      await brandKitsApi.save(kit.id, { ...kit.doc, palette });
      await refresh();
      toast.success(`Saved as ${kit.name}'s palette`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the palette");
    } finally {
      setSaving(false);
    }
  };

  return { entries, kit, save, saving };
};
