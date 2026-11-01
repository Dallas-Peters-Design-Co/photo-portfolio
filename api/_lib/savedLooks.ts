import type { getSql } from "./db.js";
import { sanitizeText } from "./httpUrl.js";

/**
 * Saved photo-editor looks (patch 046), served through api/brand-kits so the
 * project stays under Vercel's function limit:
 *
 *   GET  /api/brand-kits?looks=1                       the saved looks
 *   POST /api/brand-kits {action:"saveLook", name, edit, id?}  create or replace
 *   POST /api/brand-kits {action:"deleteLook", id}
 *
 * The edit is stored as the editor sent it, bounded in size and depth. It is
 * only ever read back by the editor, which merges it onto a neutral edit, so
 * an unknown key costs nothing and a missing one falls back to neutral.
 */

type Sql = ReturnType<typeof getSql>;

export const MAX_LOOK_NAME = 60;
export const MAX_SAVED_LOOKS = 200;
const MAX_EDIT_BYTES = 20_000;
const UUID = /^[0-9a-f-]{36}$/i;

export interface SavedLookDto {
  edit: Record<string, unknown>;
  id: string;
  name: string;
  updatedAt: string;
}

interface Row {
  edit: unknown;
  id: string;
  name: string;
  updated_at: string | Date;
}

const toDto = (row: Row): SavedLookDto => ({
  edit:
    row.edit && typeof row.edit === "object" && !Array.isArray(row.edit)
      ? (row.edit as Record<string, unknown>)
      : {},
  id: row.id,
  name: row.name,
  updatedAt: new Date(row.updated_at).toISOString(),
});

/** Plain JSON only: numbers must be finite, and nothing nested too deep. */
const plainJson = (value: unknown, depth = 0): boolean => {
  if (depth > 6) {
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

export const cleanLookEdit = (
  value: unknown
): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  if (!plainJson(value) || JSON.stringify(value).length > MAX_EDIT_BYTES) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const cleanLookName = (value: unknown): string =>
  typeof value === "string" ? sanitizeText(value).slice(0, MAX_LOOK_NAME) : "";

export const listLooks = async (sql: Sql): Promise<SavedLookDto[]> => {
  const rows = (await sql`
    SELECT id, name, edit, updated_at FROM saved_looks ORDER BY lower(name)
  `) as Row[];
  return rows.map(toDto);
};

export type LookResult =
  | { look: SavedLookDto; ok: true; status: 200 | 201 }
  | { error: string; ok: false; status: 400 | 404 | 409 };

export const saveLook = async (
  sql: Sql,
  body: Record<string, unknown>
): Promise<LookResult> => {
  const name = cleanLookName(body.name);
  if (!name) {
    return { error: "Give the look a name.", ok: false, status: 400 };
  }
  const edit = cleanLookEdit(body.edit);
  if (!edit) {
    return { error: "That look couldn't be saved.", ok: false, status: 400 };
  }
  const json = JSON.stringify(edit);
  const id = typeof body.id === "string" && UUID.test(body.id) ? body.id : null;
  if (id) {
    const rows = (await sql`
      UPDATE saved_looks SET name = ${name}, edit = ${json}::jsonb, updated_at = now()
      WHERE id = ${id}
      RETURNING id, name, edit, updated_at
    `) as Row[];
    const [row] = rows;
    return row
      ? { look: toDto(row), ok: true, status: 200 }
      : { error: "Look not found", ok: false, status: 404 };
  }
  const [count] = (await sql`SELECT count(*)::int AS n FROM saved_looks`) as {
    n: number;
  }[];
  if ((count?.n ?? 0) >= MAX_SAVED_LOOKS) {
    return {
      error: "That's the most looks that can be saved.",
      ok: false,
      status: 409,
    };
  }
  const rows = (await sql`
    INSERT INTO saved_looks (name, edit) VALUES (${name}, ${json}::jsonb)
    RETURNING id, name, edit, updated_at
  `) as Row[];
  const [row] = rows;
  return row
    ? { look: toDto(row), ok: true, status: 201 }
    : { error: "That look couldn't be saved.", ok: false, status: 400 };
};

export const deleteLook = async (sql: Sql, id: unknown): Promise<void> => {
  if (typeof id === "string" && UUID.test(id)) {
    await sql`DELETE FROM saved_looks WHERE id = ${id}`;
  }
};
