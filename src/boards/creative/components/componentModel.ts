import type { TextStyle } from "../../../../config/textStyle";
import type { BoardItem } from "../../../types";
import { newItemId } from "../../io/newItemId";

/**
 * Brand components: a group of frame-editor layers saved with a brand, and
 * dropped into any frame as a linked copy.
 *
 * A copy is made of ordinary board items (so drawing, Present, print and
 * export need nothing new), each tagged in its config with a link back:
 * the component (c), the copy (i), the component layer it came from (l), the
 * component version it last took (v), and what that version gave it (base).
 *
 * When the component changes, every copy is brought in line, except where a
 * copy has its own text, colours or font size. Those are told apart by
 * `base`: a value still equal to what the component last gave is the
 * component's, so it follows; one that differs was changed on the copy, so
 * it stays. Place, size and everything else follow the component, and only
 * when the component itself has changed, so nudging a copy around between
 * updates is never undone on its own.
 */

export interface ComponentLayer {
  body: string | null;
  config: Record<string, unknown> | null;
  fontSize: number | null;
  height: number;
  imageUrl: string | null;
  kind: BoardItem["kind"];
  /** The layer's id within the component, stable across updates. */
  lid: string;
  rotation?: number;
  textStyle?: TextStyle | null;
  thumbUrl: string | null;
  width: number;
  /** From the component's top-left. */
  x: number;
  y: number;
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
  updatedAt: string;
  width: number;
}

/** What a component gave a copy's layer, for telling overrides apart. */
export interface Base {
  background?: string;
  body?: string;
  color?: string;
  fill?: string;
  fontSize?: number;
  stroke?: string;
  x?: number;
  y?: number;
}

export interface ComponentLink {
  base: Base;
  c: string;
  i: string;
  l: string;
  v?: string;
}

export type Draft = Omit<BrandComponent, "id" | "kitId" | "updatedAt">;

const bag = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

export const linkOf = (item: BoardItem): ComponentLink | null => {
  const o = bag(bag(item.config)?.component);
  return o &&
    typeof o.c === "string" &&
    typeof o.i === "string" &&
    typeof o.l === "string"
    ? {
        base: (bag(o.base) ?? {}) as Base,
        c: o.c,
        i: o.i,
        l: o.l,
        ...(typeof o.v === "string" ? { v: o.v } : {}),
      }
    : null;
};

/** The config without the component link. */
const ownConfig = (
  config: Record<string, unknown> | null
): Record<string, unknown> | null => {
  if (!config) {
    return null;
  }
  const { component: _link, ...rest } = config;
  return Object.keys(rest).length > 0 ? rest : null;
};

/** The overridable values a layer carries now. */
const valuesOf = (
  item: Pick<BoardItem, "body" | "config" | "fontSize" | "textStyle">
): Base => {
  const out: Base = {};
  const textual = item.body !== null || item.textStyle;
  if (typeof item.body === "string") {
    out.body = item.body;
  }
  if (typeof item.fontSize === "number") {
    out.fontSize = item.fontSize;
  }
  if (textual) {
    const color = str(item.textStyle?.color);
    const background = str(item.textStyle?.background);
    if (color) {
      out.color = color;
    }
    if (background) {
      out.background = background;
    }
  }
  const fill = str(bag(item.config)?.fill);
  const stroke = str(bag(item.config)?.stroke);
  if (fill) {
    out.fill = fill;
  }
  if (stroke) {
    out.stroke = stroke;
  }
  return out;
};

const shortId = () => newItemId().replaceAll("-", "").slice(0, 12);

/** The box around some layers (unrotated). */
export const boxAround = (layers: BoardItem[]) => {
  const x = Math.min(...layers.map((l) => l.x));
  const y = Math.min(...layers.map((l) => l.y));
  return {
    height: Math.max(...layers.map((l) => l.y + l.height)) - y,
    width: Math.max(...layers.map((l) => l.x + l.width)) - x,
    x,
    y,
  };
};

/**
 * A component from layers in a frame, back to front. Layers already in a
 * copy keep their component layer ids, so updating a component from one of
 * its copies keeps every other copy matched layer for layer.
 */
export const draftFrom = (
  layers: BoardItem[],
  frame: BoardItem,
  name: string
): Draft => {
  const box = boxAround(layers);
  const ordered = [...layers].sort((a, b) => a.z - b.z);
  return {
    height: box.height,
    layers: ordered.map((item) => ({
      body: item.body,
      config: ownConfig(item.config),
      fontSize: item.fontSize,
      height: item.height,
      imageUrl: item.imageUrl,
      kind: item.kind,
      lid: linkOf(item)?.l ?? shortId(),
      rotation: item.rotation ?? 0,
      textStyle: item.textStyle ?? null,
      thumbUrl: item.thumbUrl,
      width: item.width,
      x: item.x - box.x,
      y: item.y - box.y,
    })),
    name,
    placement: {
      frameHeight: frame.height,
      frameWidth: frame.width,
      x: box.x - frame.x,
      y: box.y - frame.y,
    },
    width: box.width,
  };
};

const linkFor = (
  component: BrandComponent,
  layer: ComponentLayer,
  instance: string
): ComponentLink => ({
  base: { ...valuesOf(layer), x: layer.x, y: layer.y },
  c: component.id,
  i: instance,
  l: layer.lid,
  v: component.updatedAt,
});

const itemFrom = (
  component: BrandComponent,
  layer: ComponentLayer,
  instance: string,
  at: { x: number; y: number },
  z: number,
  keep?: BoardItem
): BoardItem => {
  const config = {
    ...(layer.config ?? {}),
    component: linkFor(component, layer, instance),
  };
  const fresh = {
    body: layer.body,
    config,
    fontSize: layer.fontSize,
    height: layer.height,
    imageUrl: layer.imageUrl,
    kind: layer.kind,
    rotation: layer.rotation ?? 0,
    textStyle: layer.textStyle ?? null,
    thumbUrl: layer.thumbUrl,
    width: layer.width,
    x: at.x + layer.x,
    y: at.y + layer.y,
    z,
  };
  if (keep) {
    return { ...keep, ...fresh };
  }
  return {
    creditName: null,
    creditUrl: null,
    id: newItemId(),
    nodeType: null,
    photoId: null,
    recipeUseId: null,
    result: null,
    runError: null,
    runState: null,
    ...fresh,
  };
};

/** Where a component goes in a frame: where it sat in the one it came from. */
export const placeIn = (component: BrandComponent, frame: BoardItem) => {
  const p = component.placement;
  const fx = p.frameWidth ? (p.x ?? 0) / p.frameWidth : 0.5;
  const fy = p.frameHeight ? (p.y ?? 0) / p.frameHeight : 0.5;
  const x = frame.x + fx * frame.width;
  const y = frame.y + fy * frame.height;
  return {
    x: Math.min(x, frame.x + frame.width - component.width / 2),
    y: Math.min(y, frame.y + frame.height - component.height / 2),
  };
};

/** A new copy of the component, its layers on top of everything in `items`. */
export const copyOf = (
  component: BrandComponent,
  at: { x: number; y: number },
  items: BoardItem[]
): BoardItem[] => {
  const instance = shortId();
  const top = Math.max(0, ...items.map((i) => i.z)) + 1;
  return component.layers.map((layer, k) =>
    itemFrom(component, layer, instance, at, top + k)
  );
};

/** Each copy's layers, by component and copy. */
const copies = (items: BoardItem[]) => {
  const out = new Map<string, { c: string; items: BoardItem[] }>();
  for (const item of items) {
    const link = linkOf(item);
    if (link) {
      const key = `${link.c}|${link.i}`;
      const entry = out.get(key) ?? { c: link.c, items: [] };
      entry.items.push(item);
      out.set(key, entry);
    }
  }
  return out;
};

/** The copy's top-left: the place most of its layers agree on. */
const anchorOf = (layers: BoardItem[]) => {
  const votes = new Map<string, { n: number; x: number; y: number }>();
  for (const item of layers) {
    const base = linkOf(item)?.base;
    const x = item.x - (base?.x ?? 0);
    const y = item.y - (base?.y ?? 0);
    const key = `${Math.round(x)}|${Math.round(y)}`;
    const v = votes.get(key) ?? { n: 0, x, y };
    v.n += 1;
    votes.set(key, v);
  }
  return [...votes.values()].sort((a, b) => b.n - a.n)[0] ?? { x: 0, y: 0 };
};

/** A layer's overridable values: its own where it has them, else the component's. */
const merged = (was: BoardItem, layer: ComponentLayer) => {
  const base = linkOf(was)?.base ?? {};
  const now = valuesOf(was);
  const next = valuesOf(layer);
  const pick = <K extends keyof Base>(key: K) =>
    now[key] !== undefined && now[key] !== base[key] ? now[key] : next[key];
  const body = pick("body");
  const fontSize = pick("fontSize");
  const color = pick("color");
  const background = pick("background");
  const fill = pick("fill");
  const stroke = pick("stroke");
  return {
    body: body ?? layer.body,
    config: {
      ...(layer.config ?? {}),
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
    },
    fontSize: fontSize ?? layer.fontSize,
    textStyle: layer.textStyle
      ? {
          ...layer.textStyle,
          ...(color ? { color } : {}),
          ...(background ? { background } : {}),
        }
      : (layer.textStyle ?? null),
  };
};

/**
 * One copy brought in line with its component. A layer whose picture changed
 * comes back as a new item (a board save never changes an existing item's
 * picture); layers the component gained are added, ones it lost removed.
 */
const syncCopy = (
  component: BrandComponent,
  layers: BoardItem[],
  keepOverrides: boolean
): BoardItem[] => {
  const at = anchorOf(layers);
  const instance = linkOf(layers[0] as BoardItem)?.i ?? shortId();
  const byLid = new Map(layers.map((l) => [linkOf(l)?.l, l]));
  const z0 = Math.min(...layers.map((l) => l.z));
  return component.layers.map((layer, k) => {
    const was = byLid.get(layer.lid);
    const made = itemFrom(component, layer, instance, at, z0 + k, was);
    if (!was) {
      return made;
    }
    const sameImage = was.imageUrl === layer.imageUrl;
    const values = keepOverrides ? merged(was, layer) : null;
    const next: BoardItem = {
      ...made,
      ...(values ?? {}),
      config: {
        ...(values ? values.config : (made.config ?? {})),
        component: linkFor(component, layer, instance),
      },
    };
    return sameImage ? next : { ...next, id: newItemId() };
  });
};

/**
 * The board with every out-of-date copy brought in line, or null when nothing
 * changed. Copies of components that aren't loaded are left alone.
 */
export const syncAll = (
  items: BoardItem[],
  components: BrandComponent[]
): BoardItem[] | null => {
  const byId = new Map(components.map((c) => [c.id, c]));
  const replace = new Map<string, BoardItem[]>();
  for (const [key, copy] of copies(items)) {
    const component = byId.get(copy.c);
    const stale = copy.items.some((i) => linkOf(i)?.v !== component?.updatedAt);
    if (component && stale) {
      replace.set(key, syncCopy(component, copy.items, true));
    }
  }
  if (replace.size === 0) {
    return null;
  }
  const out: BoardItem[] = [];
  const placed = new Set<string>();
  for (const item of items) {
    const link = linkOf(item);
    const key = link ? `${link.c}|${link.i}` : null;
    const next = key ? replace.get(key) : undefined;
    if (!(key && next)) {
      out.push(item);
    } else if (!placed.has(key)) {
      placed.add(key);
      out.push(...next);
    }
  }
  return out;
};

/** A copy's layers put back to exactly the component (overrides dropped). */
export const resetCopy = (
  items: BoardItem[],
  component: BrandComponent,
  instance: string
): BoardItem[] => {
  const mine = items.filter((i) => linkOf(i)?.i === instance);
  if (mine.length === 0) {
    return items;
  }
  const next = syncCopy(component, mine, false);
  const out = items.filter((i) => linkOf(i)?.i !== instance);
  return [...out, ...next];
};

/** A copy made ordinary layers: the link dropped, everything else kept. */
export const detachCopy = (items: BoardItem[], instance: string) =>
  items.map((item) =>
    linkOf(item)?.i === instance
      ? { ...item, config: ownConfig(item.config) }
      : item
  );

/** Every layer of the copy a layer belongs to. */
export const copyLayers = (items: BoardItem[], item: BoardItem) => {
  const link = linkOf(item);
  return link ? items.filter((i) => linkOf(i)?.i === link.i) : [];
};
