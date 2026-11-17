/**
 * Shaders kept in a brand kit: a named shader stack, saved from a board's
 * shader panel and placed on any board from the Brand panel.
 *
 * The stack is the board's own shape (src/boards/shaders/shaderConfig.ts):
 * layers, each a shader by name with the props changed from its defaults,
 * effects holding what they apply to. Kept dependency-free like the rest of
 * the kit document, so it is cleaned here rather than by the board's parser.
 */

export interface KitShaderLayer {
  children?: KitShaderLayer[];
  enabled?: boolean;
  id: string;
  name: string;
  props: Record<string, unknown>;
}

export interface KitShader {
  id: string;
  imageFit?: "contain" | "cover";
  layers: KitShaderLayer[];
  name: string;
}

export const MAX_KIT_SHADERS = 24;
const MAX_NAME = 80;
const MAX_DEPTH = 6;
const MAX_LAYERS = 48;
/** A layer's props as JSON: colours, numbers, a picture's address. */
const MAX_PROPS_CHARS = 6000;
const SHADER_NAME = /^[A-Za-z][A-Za-z0-9]{0,59}$/;
const LAYER_ID = /^[\w-]{1,40}$/;

const plainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** One layer, cleaned, or null when it is dropped; `index` is its place among the kept layers. */
const cleanLayer = (
  raw: unknown,
  depth: number,
  budget: { left: number },
  index: number
): KitShaderLayer | null => {
  const o = plainObject(raw) ? raw : {};
  const name = typeof o.name === "string" ? o.name : "";
  if (!SHADER_NAME.test(name)) {
    return null;
  }
  const props = plainObject(o.props) ? o.props : {};
  if (JSON.stringify(props).length > MAX_PROPS_CHARS) {
    return null;
  }
  budget.left -= 1;
  const children = Array.isArray(o.children)
    ? cleanLayers(o.children, depth + 1, budget)
    : undefined;
  return {
    ...(children ? { children } : {}),
    ...(o.enabled === false ? { enabled: false } : {}),
    id:
      typeof o.id === "string" && LAYER_ID.test(o.id)
        ? o.id
        : `l${index}-${depth}`,
    name,
    props,
  };
};

/** A stack's layers, cleaned; `budget` caps the layers across the whole tree. */
const cleanLayers = (
  value: unknown,
  depth: number,
  budget: { left: number }
): KitShaderLayer[] => {
  if (!Array.isArray(value) || depth > MAX_DEPTH) {
    return [];
  }
  const layers: KitShaderLayer[] = [];
  for (const raw of value) {
    if (budget.left <= 0) {
      break;
    }
    const layer = cleanLayer(raw, depth, budget, layers.length);
    if (layer) {
      layers.push(layer);
    }
  }
  return layers;
};

/** One kit shader, or null when it has no name, id or layers. */
export const cleanKitShader = (value: unknown): KitShader | null => {
  if (!plainObject(value)) {
    return null;
  }
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const layers = cleanLayers(value.layers, 0, { left: MAX_LAYERS });
  if (!(name && LAYER_ID.test(id) && layers.length > 0)) {
    return null;
  }
  return {
    id,
    ...(value.imageFit === "cover" || value.imageFit === "contain"
      ? { imageFit: value.imageFit }
      : {}),
    layers,
    name: name.slice(0, MAX_NAME),
  };
};

export const cleanKitShaders = (value: unknown): KitShader[] =>
  (Array.isArray(value) ? value : [])
    .map(cleanKitShader)
    .filter((shader): shader is KitShader => shader !== null)
    .slice(0, MAX_KIT_SHADERS);
