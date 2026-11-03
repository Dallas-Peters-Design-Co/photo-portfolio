import type { TextStyle } from "../../../config/textStyle";
import type { BoardItem } from "../../types";
import { newItemId } from "../io/newItemId";

/**
 * Brand components, Figma style: a group of frame-editor layers saved with a
 * brand, placed on a board as ONE item (kind "component") that is drawn from
 * the component. The layers inside can't be touched from an instance; what an
 * instance may change is what the component exposes as properties: a layer's
 * text (an input) or one of its colours (a colour picker). Change the
 * component and every instance changes, because each is drawn from it.
 */

export interface ComponentLayer {
  body: string | null;
  config: Record<string, unknown> | null;
  fontSize: number | null;
  height: number;
  imageUrl: string | null;
  kind: BoardItem["kind"];
  /** The layer's id within the component, stable across edits. */
  lid: string;
  rotation?: number;
  textStyle?: TextStyle | null;
  thumbUrl: string | null;
  width: number;
  /** From the component's top-left. */
  x: number;
  y: number;
}

export type PropField = "background" | "body" | "color" | "fill" | "stroke";

/** Something an instance may set: one layer's text or one of its colours. */
export interface ComponentProp {
  field: PropField;
  id: string;
  lid: string;
  name: string;
  type: "color" | "text";
}

export interface BrandComponent {
  height: number;
  id: string;
  kitId: string;
  layers: ComponentLayer[];
  name: string;
  /** Where it sat in the frame it was made in, and that frame's size. */
  placement: {
    frameHeight?: number;
    frameWidth?: number;
    x?: number;
    y?: number;
  };
  props: ComponentProp[];
  updatedAt: string;
  width: number;
}

export type Draft = Omit<BrandComponent, "id" | "kitId" | "updatedAt">;

export interface Instance {
  component: string;
  opacity?: number;
  props: Record<string, string>;
}

const bag = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

export const instanceOf = (item: BoardItem): Instance | null => {
  const o = bag(item.config);
  if (item.kind !== "component" || typeof o?.component !== "string") {
    return null;
  }
  const props: Record<string, string> = {};
  for (const [k, v] of Object.entries(bag(o.props) ?? {})) {
    if (typeof v === "string") {
      props[k] = v;
    }
  }
  return {
    component: o.component,
    props,
    ...(typeof o.opacity === "number" ? { opacity: o.opacity } : {}),
  };
};

/** The fields each kind of layer can expose, with their property type. */
export const FIELDS_OF: Record<
  string,
  { field: PropField; label: string; type: ComponentProp["type"] }[]
> = {
  drawing: [
    { field: "fill", label: "Fill", type: "color" },
    { field: "stroke", label: "Outline", type: "color" },
  ],
  note: [
    { field: "body", label: "Text", type: "text" },
    { field: "color", label: "Text colour", type: "color" },
    { field: "background", label: "Box colour", type: "color" },
  ],
  text: [
    { field: "body", label: "Text", type: "text" },
    { field: "color", label: "Text colour", type: "color" },
    { field: "background", label: "Box colour", type: "color" },
  ],
};

type FieldHolder = Pick<ComponentLayer, "body" | "config" | "textStyle">;

export const fieldValue = (
  layer: FieldHolder,
  field: PropField
): string | undefined => {
  if (field === "body") {
    return layer.body ?? undefined;
  }
  if (field === "color" || field === "background") {
    const v = layer.textStyle?.[field];
    return typeof v === "string" ? v : undefined;
  }
  const v = bag(layer.config)?.[field];
  return typeof v === "string" ? v : undefined;
};

export const withField = <T extends FieldHolder>(
  layer: T,
  field: PropField,
  value: string
): T => {
  if (field === "body") {
    return { ...layer, body: value };
  }
  if (field === "color" || field === "background") {
    return {
      ...layer,
      textStyle: { ...(layer.textStyle ?? {}), [field]: value } as TextStyle,
    };
  }
  return { ...layer, config: { ...(layer.config ?? {}), [field]: value } };
};

/** A property's value on an instance: its own, else the component's. */
export const propValue = (
  component: BrandComponent,
  prop: ComponentProp,
  values: Record<string, string>
): string => {
  const own = values[prop.id];
  if (own !== undefined) {
    return own;
  }
  const layer = component.layers.find((l) => l.lid === prop.lid);
  return (layer ? fieldValue(layer, prop.field) : undefined) ?? "";
};

/** The component's layers with an instance's property values applied. */
export const resolvedLayers = (
  component: BrandComponent,
  values: Record<string, string>
): ComponentLayer[] =>
  component.layers.map((layer) =>
    component.props
      .filter((p) => p.lid === layer.lid && values[p.id] !== undefined)
      .reduce((l, p) => withField(l, p.field, values[p.id] as string), layer)
  );

/** How much an instance's box scales its component: uniformly, to fit. */
export const scaleOf = (
  item: Pick<BoardItem, "height" | "width">,
  component: BrandComponent
) =>
  Math.min(item.width / component.width, item.height / component.height) || 1;

const scaledConfig = (
  config: Record<string, unknown> | null,
  k: number,
  opacity: number | undefined
): Record<string, unknown> | null => {
  if (!config && opacity === undefined) {
    return null;
  }
  const out: Record<string, unknown> = { ...(config ?? {}) };
  for (const key of ["strokeWidth", "radius"]) {
    if (typeof out[key] === "number") {
      out[key] = (out[key] as number) * k;
    }
  }
  if (opacity !== undefined) {
    out.opacity = (typeof out.opacity === "number" ? out.opacity : 1) * opacity;
  }
  return out;
};

/** The id an instance's inner layer is drawn and measured under. */
export const innerId = (instanceId: string, lid: string) =>
  `${instanceId}~${lid}`;

/**
 * An instance as the board items it draws: the component's layers, its
 * property values applied, scaled into its box. Used by every renderer and
 * export, so an instance looks the same everywhere.
 */
export const expandInstance = (
  item: BoardItem,
  component: BrandComponent
): BoardItem[] => {
  const instance = instanceOf(item);
  const k = scaleOf(item, component);
  return resolvedLayers(component, instance?.props ?? {}).map((layer) => ({
    body: layer.body,
    config: scaledConfig(layer.config, k, instance?.opacity),
    creditName: null,
    creditUrl: null,
    fontSize: layer.fontSize === null ? null : layer.fontSize * k,
    height: layer.height * k,
    id: innerId(item.id, layer.lid),
    imageUrl: layer.imageUrl,
    kind: layer.kind,
    nodeType: null,
    photoId: null,
    result: null,
    rotation: layer.rotation ?? 0,
    runError: null,
    runState: null,
    textStyle: layer.textStyle ?? null,
    thumbUrl: layer.thumbUrl,
    width: layer.width * k,
    x: item.x + layer.x * k,
    y: item.y + layer.y * k,
    z: item.z,
  }));
};

/** Layers with every instance replaced by what it draws. */
export const expandAll = (
  layers: BoardItem[],
  lookup: (id: string) => BrandComponent | null
): BoardItem[] =>
  layers.flatMap((item) => {
    const instance = instanceOf(item);
    const component = instance ? lookup(instance.component) : null;
    return component ? expandInstance(item, component) : [item];
  });

const SPACES = /\s+/;

/** A short label for a component layer: its first words, or its shape. */
export const layerLabel = (
  layer: Pick<ComponentLayer, "body" | "config" | "kind">
) => {
  if (layer.body?.trim()) {
    const words = layer.body.trim().split(SPACES).slice(0, 3).join(" ");
    return words.length > 24 ? `${words.slice(0, 24)}…` : words;
  }
  const tool = bag(layer.config)?.tool;
  if (layer.kind === "drawing") {
    return tool === "ellipse" ? "Ellipse" : "Shape";
  }
  return "Picture";
};

/**
 * The properties a new component starts with: each text layer's words, so
 * every copy can say something different from the moment it's made.
 */
export const startingProps = (draft: Draft): ComponentProp[] =>
  draft.layers
    .filter((l) => (l.kind === "text" || l.kind === "note") && l.body !== null)
    .map((l, k) => ({
      field: "body" as const,
      id: `text${k + 1}`,
      lid: l.lid,
      name: layerLabel(l),
      type: "text" as const,
    }));

/** A component from layers in a frame, back to front. */
export const draftFrom = (
  layers: BoardItem[],
  frame: Pick<BoardItem, "height" | "width" | "x" | "y">,
  name: string,
  props: ComponentProp[] = [],
  lidOf: (item: BoardItem) => string | null = () => null
): Draft => {
  const x = Math.min(...layers.map((l) => l.x));
  const y = Math.min(...layers.map((l) => l.y));
  const width = Math.max(...layers.map((l) => l.x + l.width)) - x;
  const height = Math.max(...layers.map((l) => l.y + l.height)) - y;
  const ordered = [...layers].sort((a, b) => a.z - b.z);
  return {
    height,
    layers: ordered.map((item) => {
      const { component: _link, ...config } = item.config ?? {};
      return {
        body: item.body,
        config: Object.keys(config).length > 0 ? config : null,
        fontSize: item.fontSize,
        height: item.height,
        imageUrl: item.imageUrl,
        kind: item.kind,
        lid: lidOf(item) ?? newItemId().replaceAll("-", "").slice(0, 12),
        rotation: item.rotation ?? 0,
        textStyle: item.textStyle ?? null,
        thumbUrl: item.thumbUrl,
        width: item.width,
        x: item.x - x,
        y: item.y - y,
      };
    }),
    name,
    placement: {
      frameHeight: frame.height,
      frameWidth: frame.width,
      x: x - frame.x,
      y: y - frame.y,
    },
    props,
    width,
  };
};

/** A new instance at a place, on top of everything in `items`. */
export const newInstance = (
  component: BrandComponent,
  at: { x: number; y: number },
  items: BoardItem[]
): BoardItem => ({
  body: null,
  config: { component: component.id, props: {} },
  creditName: null,
  creditUrl: null,
  fontSize: null,
  height: component.height,
  id: newItemId(),
  imageUrl: null,
  kind: "component",
  nodeType: null,
  photoId: null,
  recipeUseId: null,
  result: null,
  rotation: 0,
  runError: null,
  runState: null,
  textStyle: null,
  thumbUrl: null,
  width: component.width,
  x: at.x,
  y: at.y,
  z: Math.max(0, ...items.map((i) => i.z)) + 1,
});

/** Where a component goes in a frame: where it sat in the one it came from. */
export const placeIn = (
  component: BrandComponent,
  frame: Pick<BoardItem, "height" | "width" | "x" | "y">
) => {
  const p = component.placement;
  const fx = p.frameWidth ? (p.x ?? 0) / p.frameWidth : 0.5;
  const fy = p.frameHeight ? (p.y ?? 0) / p.frameHeight : 0.5;
  return {
    x: Math.min(
      frame.x + fx * frame.width,
      frame.x + frame.width - component.width / 2
    ),
    y: Math.min(
      frame.y + fy * frame.height,
      frame.y + frame.height - component.height / 2
    ),
  };
};
