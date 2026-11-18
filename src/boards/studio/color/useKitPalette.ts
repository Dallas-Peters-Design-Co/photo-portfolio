import { useState } from "react";
import { toast } from "sonner";
import type { BrandKitDoc, PaletteEntry } from "../../../../config/brandKit.js";
import { useBrandKits } from "../../../hooks/useBrandKits";
import { brandKitsApi } from "../../../services/brandKitService";
import { useActiveBrand } from "../../brand/ActiveBrand";
import { keepPaletteNames } from "./keepPaletteNames";

/**
 * The active brand's palette, and saving a new one (or any other part of
 * the kit, via `update`) over it.
 *
 * A save is a new kit version, so the old palette is one restore away in the
 * kit's history. The kit keeps its names and roles across a save.
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
   * Saves a palette over the kit's. The kit keeps its names and roles, place
   * by place (keepPaletteNames.ts); `byPlace`, the entries the colours were
   * loaded from, only names a place the kit had nothing in.
   */
  const save = (values: string[], byPlace?: PaletteEntry[] | null) =>
    update({ palette: keepPaletteNames(entries, values, byPlace) }, "palette");

  /**
   * Saves a palette into any kit, not only the board's: how one brand's
   * colours are carried to another. The colours change; the target keeps its
   * own names and roles, which its styles are written against.
   */
  const saveTo = (
    kitId: string,
    values: string[],
    roles: string[],
    names?: string[]
  ): Promise<boolean> => {
    const target = kits.find((candidate) => candidate.id === kitId);
    if (!target) {
      return Promise.resolve(false);
    }
    const loaded = values.map((_, i) => ({ name: names?.[i], role: roles[i] }));
    return updateFor(
      target,
      { palette: keepPaletteNames(target.resolvedDoc.palette, values, loaded) },
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

  return { entries, kit, kits, save, saveTo, saving, update, updateFor };
};
