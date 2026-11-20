import type { KitShader } from "../../../config/kitShaders.js";
import { ShaderView } from "../shaders/ShaderView";
import {
  DEFAULT_SOURCE,
  isEffect,
  normalizeLayers,
  type ShaderConfig,
  type ShaderLayer,
} from "../shaders/shaderConfig";
import "./KitShaderPreview.css";

/** A kit shader's stack, as the board's shader item takes it. */
export const shaderConfigOf = (shader: KitShader): ShaderConfig => ({
  ...(shader.imageFit ? { imageFit: shader.imageFit } : {}),
  kitShaderId: shader.id,
  layers: shader.layers,
});

/** Old kit stacks may contain an effect saved before empty effects were seeded. */
const previewLayers = (layers: ShaderLayer[]): ShaderLayer[] =>
  normalizeLayers(layers).map((layer) => {
    const children = previewLayers(layer.children ?? []);
    if (isEffect(layer.name) && children.length === 0) {
      return {
        ...layer,
        children: [
          {
            id: `${layer.id}-preview`,
            name: DEFAULT_SOURCE,
            props: {},
          },
        ],
      };
    }
    return layer.children ? { ...layer, children } : layer;
  });

/** A kit shader drawn live, small: a tile in the Brand panel or the kit editor. */
export function KitShaderPreview({ shader }: { shader: KitShader }) {
  return (
    <span aria-hidden className="kit-shader-preview">
      <ShaderView
        config={{
          ...shaderConfigOf(shader),
          layers: previewLayers(shader.layers),
        }}
      />
    </span>
  );
}
