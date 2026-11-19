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

const nameForShader = async (
  existingName: string | undefined,
  ask: () => Promise<string | null>
): Promise<string | undefined> => existingName ?? (await ask())?.trim();

const atShaderLimit = (base: KitShader[], existing: KitShader | undefined) =>
  !existing && base.length >= MAX_KIT_SHADERS;

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
  ): Promise<string | null> => {
    if (!kit) {
      return null;
    }
    const base =
      kit.doc.shaders.length > 0 ? kit.doc.shaders : kit.resolvedDoc.shaders;
    const existing = base.find((shader) => shader.id === config.kitShaderId);
    const name = await nameForShader(existing?.name, () =>
      prompt({
        confirmLabel: "Save to brand",
        defaultValue: suggested,
        placeholder: "Brand glow",
        title: `Save this shader to ${kit.name}`,
      })
    );
    if (!name) {
      return null;
    }
    if (atShaderLimit(base, existing)) {
      toast.error(`${kit.name} already has ${MAX_KIT_SHADERS} shaders.`);
      return null;
    }
    try {
      const url = await resolveImage();
      const shader: KitShader = {
        id: existing?.id ?? newItemId(),
        ...(config.imageFit ? { imageFit: config.imageFit } : {}),
        layers: withImage(normalizeLayers(config.layers), url, config.imageFit),
        name,
      };
      await brandKitsApi.save(kit.id, {
        ...kit.doc,
        shaders: existing
          ? base.map((item) => (item.id === shader.id ? shader : item))
          : [...base, shader],
      });
      // The board's Brand panel, kit editor and pickers all refresh this list.
      await mutate((key) => Array.isArray(key) && key[0] === "brand-kits");
      toast.success(
        existing ? `Updated ${name} in ${kit.name}` : `Saved to ${kit.name}`
      );
      return shader.id;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save the shader."
      );
      return null;
    }
  };

  return { kitName: kit?.name ?? null, save };
};
