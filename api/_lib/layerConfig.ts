import { clamp, text } from "./values.js";

/**
 * What a picture or text layer may keep in `config`, allowlisted like every
 * other kind's settings (boardItemConfig.ts).
 *
 * - radius: a picture's corner radius;
 * - opacity: how see-through the layer is, 0 to 1 (the frame editor's slider);
 * - studio: how a Studio picture was made (tool, settings, size, source
 *   picture), so "Edit in Studio" can reopen it as it was.
 */

const MAX_SETTINGS = 40;
const MAX_SETTING_TEXT = 500;
const MAX_SIDE = 10_000;
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
      out[key] = value.slice(0, MAX_SETTING_TEXT);
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

/** Opacity below 1 is kept; fully opaque is the default and isn't stored. */
const opacityOf = (o: Bag | null): Bag =>
  finite(o?.opacity) && o.opacity < 1
    ? { opacity: clamp(o.opacity, 0, 1) }
    : {};

const orNull = (config: Bag): Bag | null =>
  Object.keys(config).length > 0 ? config : null;

export const parseImageConfig = (raw: unknown): Bag | null => {
  const o = bagOf(raw);
  const radius = o?.radius;
  const studio = parseStudioRecipe(o?.studio);
  return orNull({
    ...(finite(radius) && radius > 0 ? { radius: clamp(radius, 0, 5000) } : {}),
    ...opacityOf(o),
    ...(studio ? { studio } : {}),
  });
};

export const parseTextConfig = (raw: unknown): Bag | null =>
  orNull(opacityOf(bagOf(raw)));
