import { clamp, text } from "./values.js";

/**
 * What a picture or text layer may keep in `config`, allowlisted like every
 * other kind's settings (boardItemConfig.ts).
 *
 * - radius: a picture's corner radius;
 * - position: which part of a picture stays in view when cropped;
 * - fit: "contain" to show the whole picture inside its box (cover, the
 *   default, isn't stored);
 * - opacity: how see-through the layer is, 0 to 1 (the frame editor's slider);
 * - studio: how a Studio picture was made (tool, settings, size, source
 *   picture), so "Edit in Studio" can reopen it as it was.
 * - component: the brand component this layer is a copy of (componentLink),
 *   and what the component last gave it, so a component update can tell a
 *   value changed on this copy from one it was handed.
 */

const MAX_SETTINGS = 40;
const MAX_SETTING_TEXT = 500;
/** A mosaic's hand-painted tiles: a few thousand short entries. */
const LONG_SETTINGS: Record<string, number> = { painted: 80_000 };
// A 24×36 poster at print size is 7200×10800.
const MAX_SIDE = 16_000;
const TOOL_ID = /^[a-z][a-z0-9-]{0,39}$/;
const KEY = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;

type Bag = Record<string, unknown>;

const bagOf = (raw: unknown): Bag | null =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Bag)
    : null;

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** A Studio tool's settings: short, flat, and only plain values. */
const settingsOf = (raw: unknown): Bag => {
  const out: Bag = {};
  for (const [key, value] of Object.entries(bagOf(raw) ?? {}).slice(
    0,
    MAX_SETTINGS
  )) {
    if (!KEY.test(key)) {
      continue;
    }
    if (typeof value === "boolean" || value === null || finite(value)) {
      out[key] = value;
    } else if (typeof value === "string") {
      out[key] = value.slice(0, LONG_SETTINGS[key] ?? MAX_SETTING_TEXT);
    }
  }
  return out;
};

export const parseStudioRecipe = (raw: unknown): Bag | null => {
  const o = bagOf(raw);
  const size = bagOf(o?.size);
  const tool = typeof o?.tool === "string" ? o.tool : "";
  if (!(o && size && TOOL_ID.test(tool) && finite(size.w) && finite(size.h))) {
    return null;
  }
  const image = text(o.image, 2000);
  return {
    image: image?.startsWith("https://") ? image : null,
    size: {
      h: Math.round(clamp(size.h, 1, MAX_SIDE)),
      w: Math.round(clamp(size.w, 1, MAX_SIDE)),
    },
    tool,
    values: settingsOf(o.values),
  };
};

const COMPONENT_ID = /^[0-9a-f-]{36}$/i;
const SHORT_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const COLOR = (v: unknown) => text(v, 32);

/**
 * A layer's link to a brand component: which component (c), which copy of it
 * on the board (i), which of its layers (l), the component version it last
 * took (v), and the values that version gave it (base): text, font size,
 * colours, place. Anything malformed drops the link, which leaves an
 * ordinary layer.
 */
export const parseComponentLink = (raw: unknown): Bag | null => {
  const o = bagOf(raw);
  if (
    !(
      o &&
      typeof o.c === "string" &&
      COMPONENT_ID.test(o.c) &&
      typeof o.i === "string" &&
      SHORT_ID.test(o.i) &&
      typeof o.l === "string" &&
      SHORT_ID.test(o.l)
    )
  ) {
    return null;
  }
  const b = bagOf(o.base) ?? {};
  const base: Bag = {};
  if (typeof b.body === "string") {
    base.body = b.body.slice(0, 2000);
  }
  if (finite(b.fontSize)) {
    base.fontSize = clamp(b.fontSize, 1, 5000);
  }
  // Where the component put the layer within the copy, to find the copy's
  // corner again after the whole copy has been moved.
  for (const key of ["x", "y"]) {
    if (finite(b[key])) {
      base[key] = clamp(b[key], -1_000_000, 1_000_000);
    }
  }
  for (const key of ["color", "background", "fill", "stroke"]) {
    const c = COLOR(b[key]);
    if (c) {
      base[key] = c;
    }
  }
  // The component's version (updatedAt) this copy last took.
  const v = text(o.v, 40);
  return { base, c: o.c, i: o.i, l: o.l, ...(v ? { v } : {}) };
};

const PROP_ID = /^[a-zA-Z0-9_-]{1,40}$/;
const MAX_PROPS = 40;

/**
 * A placed component (kind "component"): which component, and the value set
 * for each of its properties (text, or a colour), by property id. Values not
 * set fall back to the component's own. Without a component it's nothing.
 */
export const parseInstanceConfig = (raw: unknown): Bag | null => {
  const o = bagOf(raw);
  if (
    !(o && typeof o.component === "string" && COMPONENT_ID.test(o.component))
  ) {
    return null;
  }
  const props: Bag = {};
  for (const [key, value] of Object.entries(bagOf(o.props) ?? {}).slice(
    0,
    MAX_PROPS
  )) {
    if (PROP_ID.test(key) && typeof value === "string") {
      props[key] = value.slice(0, 2000);
    }
  }
  return { component: o.component, props, ...opacityOf(o) };
};

/** The link, as a key to spread into a config. */
export const componentOf = (o: Bag | null): Bag => {
  const component = parseComponentLink(o?.component);
  return component ? { component } : {};
};

/** Opacity below 1 is kept; fully opaque is the default and isn't stored. */
const opacityOf = (o: Bag | null): Bag =>
  finite(o?.opacity) && o.opacity < 1
    ? { opacity: clamp(o.opacity, 0, 1) }
    : {};

const orNull = (config: Bag): Bag | null =>
  Object.keys(config).length > 0 ? config : null;

/** Which part of a picture stays in view when cropped (imageAnchor.ts). */
const POSITIONS = new Set([
  "top-left",
  "top",
  "top-right",
  "left",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
]);

export const parseImageConfig = (raw: unknown): Bag | null => {
  const o = bagOf(raw);
  const radius = o?.radius;
  const studio = parseStudioRecipe(o?.studio);
  const position = typeof o?.position === "string" ? o.position : "";
  return orNull({
    ...(finite(radius) && radius > 0 ? { radius: clamp(radius, 0, 5000) } : {}),
    ...(POSITIONS.has(position) ? { position } : {}),
    ...(o?.fit === "contain" ? { fit: "contain" } : {}),
    ...opacityOf(o),
    ...(studio ? { studio } : {}),
    ...componentOf(o),
  });
};

export const parseTextConfig = (raw: unknown): Bag | null => {
  const o = bagOf(raw);
  return orNull({ ...opacityOf(o), ...componentOf(o) });
};
