import type { KitShader } from "../../../config/kitShaders.js";
import { ShaderView } from "../shaders/ShaderView";
import type { ShaderConfig } from "../shaders/shaderConfig";
import "./KitShaderPreview.css";

/** A kit shader's stack, as the board's shader item takes it. */
export const shaderConfigOf = (shader: KitShader): ShaderConfig => ({
  ...(shader.imageFit ? { imageFit: shader.imageFit } : {}),
  layers: shader.layers,
});

/** A kit shader drawn live, small: a tile in the Brand panel or the kit editor. */
export function KitShaderPreview({ shader }: { shader: KitShader }) {
  return (
    <span aria-hidden className="kit-shader-preview">
      <ShaderView config={shaderConfigOf(shader)} />
    </span>
  );
}
