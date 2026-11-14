import type { getSql } from "./db.js";
import { sanitizeText } from "./httpUrl.js";
import { settingsOf } from "./layerConfig.js";

/**
 * Saved Studio settings (patch 050), served through api/brand-kits so the
 * project stays under Vercel's function limit:
 *
 *   GET  /api/brand-kits?presets=1                          every preset
 *   POST /api/brand-kits {action:"savePreset", tool, name, values, id?}
 *   POST /api/brand-kits {action:"deletePreset", id}
 *
 * The settings are checked the same way a placed Studio picture's are
 * (layerConfig.settingsOf): flat, plain values, bounded in size.
 */

type Sql = ReturnType<typeof getSql>;

const MAX_NAME = 60;
const MAX_PRESETS = 300;
const UUID = /^[0-9a-f-]{36}$/i;
const TOOL_ID = /^[a-z][a-z0-9-]{0,39}$/;

export interface StudioPresetDto {
  id: string;
  name: string;
  tool: string;
  updatedAt: string;
  values: Record<string, unknown>;
}

interface Row {
  id: string;
  name: string;
  tool: string;
  updated_at: string | Date;
  values: unknown;
}

const toDto = (row: Row): StudioPresetDto => ({
  id: row.id,
  name: row.name,
  tool: row.tool,
  updatedAt: new Date(row.updated_at).toISOString(),
  values: settingsOf(row.values),
});

export const listPresets = async (sql: Sql): Promise<StudioPresetDto[]> => {
  const rows = (await sql`
    SELECT id, tool, name, "values", updated_at FROM studio_presets
    ORDER BY tool, lower(name)
  `) as Row[];
  return rows.map(toDto);
};

export type PresetResult =
  | { ok: true; preset: StudioPresetDto; status: 200 | 201 }
  | { error: string; ok: false; status: 400 | 404 | 409 };

export const savePreset = async (
  sql: Sql,
  body: Record<string, unknown>
): Promise<PresetResult> => {
  const name =
    typeof body.name === "string"
      ? sanitizeText(body.name).slice(0, MAX_NAME)
      : "";
  if (!name) {
    return { error: "Give the preset a name.", ok: false, status: 400 };
  }
  const tool = typeof body.tool === "string" ? body.tool : "";
  if (!TOOL_ID.test(tool)) {
    return { error: "That preset couldn't be saved.", ok: false, status: 400 };
  }
  const json = JSON.stringify(settingsOf(body.values));
  const id = typeof body.id === "string" && UUID.test(body.id) ? body.id : null;
  if (id) {
    const rows = (await sql`
      UPDATE studio_presets
      SET name = ${name}, "values" = ${json}::jsonb, updated_at = now()
      WHERE id = ${id}
      RETURNING id, tool, name, "values", updated_at
    `) as Row[];
    const [row] = rows;
    return row
      ? { ok: true, preset: toDto(row), status: 200 }
      : { error: "That preset wasn't found.", ok: false, status: 404 };
  }
  const [count] = (await sql`
    SELECT count(*)::int AS n FROM studio_presets
  `) as { n: number }[];
  if ((count?.n ?? 0) >= MAX_PRESETS) {
    return {
      error: "That's the most presets that can be saved.",
      ok: false,
      status: 409,
    };
  }
  const rows = (await sql`
    INSERT INTO studio_presets (tool, name, "values")
    VALUES (${tool}, ${name}, ${json}::jsonb)
    RETURNING id, tool, name, "values", updated_at
  `) as Row[];
  const [row] = rows;
  return row
    ? { ok: true, preset: toDto(row), status: 201 }
    : { error: "That preset couldn't be saved.", ok: false, status: 400 };
};

export const deletePreset = async (sql: Sql, id: unknown): Promise<void> => {
  if (typeof id === "string" && UUID.test(id)) {
    await sql`DELETE FROM studio_presets WHERE id = ${id}`;
  }
};
