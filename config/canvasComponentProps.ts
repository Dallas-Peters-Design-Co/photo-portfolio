import type {
  ComponentProp,
  PropField,
} from "../src/boards/components/model.js";

const LAYER_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const bagOf = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const PROP_ID = /^[a-zA-Z0-9_-]{1,40}$/;
const FIELDS = new Set([
  "background",
  "body",
  "color",
  "fill",
  "stroke",
  "tint",
]);

/** A property's shared targets: well-formed ones only, a few hundred at most. */
const moreOf = (
  value: unknown
): { more?: { field: PropField; lid: string }[] } => {
  const more = (Array.isArray(value) ? value : [])
    .slice(0, 300)
    .map(bagOf)
    .filter(
      (o): o is Record<string, unknown> =>
        o !== null &&
        typeof o.lid === "string" &&
        LAYER_ID.test(o.lid) &&
        typeof o.field === "string" &&
        FIELDS.has(o.field)
    )
    .map((o) => ({ field: o.field as PropField, lid: o.lid as string }));
  return more.length > 0 ? { more } : {};
};

/** The properties, keeping only well-formed ones. */
export const cleanProps = (value: unknown): ComponentProp[] =>
  (Array.isArray(value) ? value : [])
    .slice(0, 40)
    .map(bagOf)
    .filter(
      (o): o is Record<string, unknown> =>
        o !== null &&
        typeof o.id === "string" &&
        PROP_ID.test(o.id) &&
        typeof o.lid === "string" &&
        LAYER_ID.test(o.lid) &&
        typeof o.field === "string" &&
        FIELDS.has(o.field) &&
        (o.type === "text" || o.type === "color")
    )
    .map((o) => ({
      field: o.field as PropField,
      id: o.id as string,
      lid: o.lid as string,
      ...moreOf(o.more),
      name:
        (typeof o.name === "string"
          ? o.name.replace(/\0/g, "").trim()
          : ""
        ).slice(0, 40) || "Property",
      overridable: o.overridable !== false,
      type: o.type as ComponentProp["type"],
    }));
