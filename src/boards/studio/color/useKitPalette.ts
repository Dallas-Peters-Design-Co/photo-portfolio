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
  const { kits = brand?.kits ?? [], refresh } = useBrandKits();
  const [saving, setSaving] = useState(false);
  const kit = brand?.kit ?? null;
  const entries: PaletteEntry[] = kit?.resolvedDoc.palette ?? [];

  /**
   * Saves part of the kit as a new version; `what` names it in the toast.
   * Resolves true once saved.
   */
  const update = async (
    patch: Partial<BrandKitDoc>,
    what: string
  ): Promise<boolean> => {
    if (!kit) {
      return false;
    }
    setSaving(true);
    try {
      await brandKitsApi.save(kit.id, { ...kit.doc, ...patch });
      await refresh();
      toast.success(`Saved as ${kit.name}'s ${what}`);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Couldn't save the ${what}`);
      return false;
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

  const saveTo = (
    kitId: string,
    values: string[],
    roles: string[]
  ): Promise<boolean> => {
    const target = kits.find((candidate) => candidate.id === kitId);
    if (!target) {
      return Promise.resolve(false);
    }
    const targetEntries = target.resolvedDoc.palette;
    return updateFor(
      target,
      {
        palette: values.map((raw, i) => {
          const value = raw.toLowerCase();
          const was =
            targetEntries.find((entry) => entry.value === value) ??
            targetEntries[i] ??
            null;
          return {
            name: was?.name ?? "",
            role: roles[i] ?? was?.role ?? "",
            value,
          };
        }),
      },
      "palette"
    );
  };

  const updateFor = async (
    target: NonNullable<typeof kit>,
    patch: Partial<BrandKitDoc>,
    what: string
  ): Promise<boolean> => {
    setSaving(true);
    try {
      await brandKitsApi.save(target.id, { ...target.doc, ...patch });
      await refresh();
      toast.success(`Saved as ${target.name}'s ${what}`);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Couldn't save the ${what}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { entries, kit, kits, save, saveTo, saving, update };
};
