import type { getSql } from "./db.js";
import { sanitizeText } from "./httpUrl.js";

/**
 * Brand components (patch 048), served through api/brand-kits so the project
 * stays under Vercel's function limit:
 *
 *   GET  /api/brand-kits?components=<kitId>      a kit's components
 *   POST /api/brand-kits {action:"saveComponent", kitId, name, width, height,
 *                         placement, layers, id?}   create or replace
 *   POST /api/brand-kits {action:"deleteComponent", id}
 *
 * The layers are stored as the frame editor sent them, checked for shape and
 * size only. They're never drawn from here: the editor turns them into board
 * items, and a board save sanitises every item it's given (boardItemParse.ts),
 * so a layer that slips through as odd is refused there like any other.
 */

type Sql = ReturnType<typeof getSql>;

const MAX_NAME = 60;
const MAX_LAYERS = 120;
const MAX_LAYERS_BYTES = 400_000;
const MAX_SIDE = 100_000;
const UUID = /^[0-9a-f-]{36}$/i;
const LAYER_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const KINDS = new Set(["text", "note", "reference", "photo", "drawing"]);

/** A property an instance may set: a layer's text or one of its colours. */
type Field = "background" | "body" | "color" | "fill" | "stroke" | "tint";

export interface ComponentPropDto {
  field: Field;
  id: string;
  lid: string;
  /** Other layers' fields the same value sets. */
  more?: { field: Field; lid: string }[];
  name: string;
  type: "color" | "text";
}

export interface BrandComponentDto {
  height: number;
  id: string;
  kitId: string;
  layers: Record<string, unknown>[];
  name: string;
  placement: Record<string, unknown>;
  props: ComponentPropDto[];
  updatedAt: string;
  width: number;
}

interface Row {
  brand_kit_id: string;
  height: number;
  id: string;
  layers: unknown;
  name: string;
  placement: unknown;
  props?: unknown;
  updated_at: string | Date;
  width: number;
}

const bagOf = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

const toDto = (row: Row): BrandComponentDto => ({
  height: Number(row.height),
  id: row.id,
  kitId: row.brand_kit_id,
  layers: Array.isArray(row.layers)
    ? (row.layers.filter(bagOf) as Record<string, unknown>[])
    : [],
  name: row.name,
  placement: bagOf(row.placement) ?? {},
  props: cleanProps(row.props),
  updatedAt: new Date(row.updated_at).toISOString(),
  width: Number(row.width),
});

/** Plain JSON only: numbers must be finite, and nothing nested too deep. */
const plainJson = (value: unknown, depth = 0): boolean => {
  if (depth > 8) {
    return false;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((v) => plainJson(v, depth + 1));
  }
  if (typeof value === "object") {
    return Object.values(value as object).every((v) => plainJson(v, depth + 1));
  }
  return false;
};

const side = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= MAX_SIDE
    ? v
    : null;

/** The layers, if every one is a plain object with an id and a known kind. */
export const cleanComponentLayers = (
  value: unknown
): Record<string, unknown>[] | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  if (value.length > MAX_LAYERS || !plainJson(value)) {
    return null;
  }
  if (JSON.stringify(value).length > MAX_LAYERS_BYTES) {
    return null;
  }
  const ok = value.every((layer) => {
    const o = bagOf(layer);
    return (
      o !== null &&
      typeof o.lid === "string" &&
      LAYER_ID.test(o.lid) &&
      typeof o.kind === "string" &&
      KINDS.has(o.kind)
    );
  });
  return ok ? (value as Record<string, unknown>[]) : null;
};

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
const moreOf = (value: unknown): { more?: { field: Field; lid: string }[] } => {
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
    .map((o) => ({ field: o.field as Field, lid: o.lid as string }));
  return more.length > 0 ? { more } : {};
};

/** The properties, keeping only well-formed ones. */
export const cleanProps = (value: unknown): ComponentPropDto[] =>
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
      field: o.field as Field,
      id: o.id as string,
      lid: o.lid as string,
      ...moreOf(o.more),
      name:
        (typeof o.name === "string" ? sanitizeText(o.name) : "").slice(0, 40) ||
        "Property",
      type: o.type as ComponentPropDto["type"],
    }));

/**
 * The components a board's items place, for drawing them: sent with the
 * board, so a published board and Present draw instances without signing in.
 */
export const componentsUsedBy = async (
  sql: Sql,
  items: { config?: unknown; kind: string }[]
): Promise<BrandComponentDto[]> => {
  const ids = [
    ...new Set(
      items
        .filter((i) => i.kind === "component")
        .map((i) => bagOf(i.config)?.component)
        .filter((id): id is string => typeof id === "string" && UUID.test(id))
    ),
  ];
  if (ids.length === 0) {
    return [];
  }
  const rows = (await sql`
    SELECT id, brand_kit_id, name, width, height, placement, layers, props, updated_at
    FROM brand_components WHERE id = ANY(${ids}::uuid[])
  `) as Row[];
  return rows.map(toDto);
};

const cleanPlacement = (value: unknown): Record<string, number> => {
  const o = bagOf(value) ?? {};
  const out: Record<string, number> = {};
  for (const key of ["x", "y", "frameWidth", "frameHeight"]) {
    const n = o[key];
    if (typeof n === "number" && Number.isFinite(n)) {
      out[key] = Math.max(-MAX_SIDE, Math.min(MAX_SIDE, n));
    }
  }
  return out;
};

export const listComponents = async (
  sql: Sql,
  kitId: unknown
): Promise<BrandComponentDto[]> => {
  if (typeof kitId !== "string" || !UUID.test(kitId)) {
    return [];
  }
  const rows = (await sql`
    SELECT id, brand_kit_id, name, width, height, placement, layers, props, updated_at
    FROM brand_components WHERE brand_kit_id = ${kitId}
    ORDER BY lower(name)
  `) as Row[];
  return rows.map(toDto);
};

export type ComponentResult =
  | { component: BrandComponentDto; ok: true; status: 200 | 201 }
  | { error: string; ok: false; status: 400 | 404 };

export const saveComponent = async (
  sql: Sql,
  body: Record<string, unknown>
): Promise<ComponentResult> => {
  const name =
    typeof body.name === "string"
      ? sanitizeText(body.name).slice(0, MAX_NAME)
      : "";
  if (!name) {
    return { error: "Give the component a name.", ok: false, status: 400 };
  }
  const width = side(body.width);
  const height = side(body.height);
  const layers = cleanComponentLayers(body.layers);
  if (!(width && height && layers)) {
    return {
      error: "That component couldn't be saved.",
      ok: false,
      status: 400,
    };
  }
  const placement = JSON.stringify(cleanPlacement(body.placement));
  const props = JSON.stringify(cleanProps(body.props));
  const json = JSON.stringify(layers);
  const id = typeof body.id === "string" && UUID.test(body.id) ? body.id : null;
  if (id) {
    const rows = (await sql`
      UPDATE brand_components
      SET name = ${name}, width = ${width}, height = ${height},
          placement = ${placement}::jsonb, layers = ${json}::jsonb,
          props = ${props}::jsonb,
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, brand_kit_id, name, width, height, placement, layers, props, updated_at
    `) as Row[];
    const [row] = rows;
    return row
      ? { component: toDto(row), ok: true, status: 200 }
      : { error: "That component wasn't found.", ok: false, status: 404 };
  }
  const kitId = typeof body.kitId === "string" ? body.kitId : "";
  if (!UUID.test(kitId)) {
    return { error: "Choose a brand first.", ok: false, status: 400 };
  }
  const kits = (await sql`
    SELECT id FROM brand_kits WHERE id = ${kitId} LIMIT 1
  `) as { id: string }[];
  if (kits.length === 0) {
    return { error: "That brand wasn't found.", ok: false, status: 404 };
  }
  const rows = (await sql`
    INSERT INTO brand_components (brand_kit_id, name, width, height, placement, layers, props)
    VALUES (${kitId}, ${name}, ${width}, ${height}, ${placement}::jsonb, ${json}::jsonb, ${props}::jsonb)
    RETURNING id, brand_kit_id, name, width, height, placement, layers, props, updated_at
  `) as Row[];
  const [row] = rows;
  return row
    ? { component: toDto(row), ok: true, status: 201 }
    : { error: "That component couldn't be saved.", ok: false, status: 400 };
};

export const deleteComponent = async (sql: Sql, id: unknown): Promise<void> => {
  if (typeof id === "string" && UUID.test(id)) {
    await sql`DELETE FROM brand_components WHERE id = ${id}`;
  }
};
