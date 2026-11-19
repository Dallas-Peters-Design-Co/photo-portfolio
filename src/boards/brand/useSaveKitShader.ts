import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { type KitShader, MAX_KIT_SHADERS } from "../../../config/kitShaders.js";
import { useConfirm } from "../../components/admin/ConfirmProvider";
import { brandKitsApi } from "../../services/brandKitService";
import { newItemId } from "../io/newItemId";
import {
  normalizeLayers,
  type ShaderConfig,
  withImage,
} from "../shaders/shaderConfig";
import { useActiveBrand } from "./ActiveBrand";

/**
 * Saves a board's shader stack into the board's brand kit (the Brand
 * panel's choice), named, so any board in that brand can place it again.
 * A sub-brand using its parent's shaders starts from those, as adding a
 * component style does, so saving one doesn't hide the rest.
 */
export const useSaveKitShader = () => {
  const kit = useActiveBrand()?.kit ?? null;
  const { prompt } = useConfirm();
  const { mutate } = useSWRConfig();

  const save = async (
    config: ShaderConfig,
    suggested: string,
    resolveImage: () => Promise<string | null>
  ) => {
    if (!kit) {
      return;
    }
    const name = (
      await prompt({
        confirmLabel: "Save to brand",
        defaultValue: suggested,
        placeholder: "Brand glow",
        title: `Save this shader to ${kit.name}`,
      })
    )?.trim();
    if (!name) {
      return;
    }
    const base =
      kit.doc.shaders.length > 0 ? kit.doc.shaders : kit.resolvedDoc.shaders;
    if (base.length >= MAX_KIT_SHADERS) {
      toast.error(`${kit.name} already has ${MAX_KIT_SHADERS} shaders.`);
      return;
    }
    try {
      const url = await resolveImage();
      const shader: KitShader = {
        id: newItemId(),
        ...(config.imageFit ? { imageFit: config.imageFit } : {}),
        layers: withImage(normalizeLayers(config.layers), url, config.imageFit),
        name,
      };
      await brandKitsApi.save(kit.id, {
        ...kit.doc,
        shaders: [...base, shader],
      });
      // Every reader of the kits (the Brand panel, pickers) sees it now.
      await mutate((key) => Array.isArray(key) && key[0] === "brand-kits");
      toast.success(`Saved to ${kit.name}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save the shader."
      );
    }
  };

  return { kitName: kit?.name ?? null, save };
};
