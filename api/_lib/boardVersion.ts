import type { getSql } from "./db.js";

type Sql = ReturnType<typeof getSql>;

/**
 * Why a board PATCH can't go ahead, or null when it can: the board doesn't
 * exist (404), or the arrangement is being saved from an out-of-date copy
 * (409).
 *
 * The editor sends the version (updated_at) of the board it last loaded or
 * saved. If the board has been saved since by anything else (another tab,
 * another window, the desktop app), that copy is behind, and saving it would
 * put the older arrangement back over newer work, which is exactly how a
 * forgotten tab kept reverting a day's mosaics. Such a save is refused and
 * the editor says so. A save without a version (older clients, other tools
 * writing to a board) is let through as before, and so is one that only
 * renames or publishes.
 */
export async function saveRefusal(
  sql: Sql,
  id: string,
  body: Record<string, unknown>
): Promise<{ body: Record<string, string>; status: number } | null> {
  const rows = (await sql`
    SELECT updated_at FROM boards WHERE id::text = ${id} LIMIT 1
  `) as { updated_at: Date | string }[];
  const [row] = rows;
  if (!row) {
    return { body: { error: "Board not found" }, status: 404 };
  }
  const base = body.baseUpdatedAt;
  const arranging = Array.isArray(body.items) || Array.isArray(body.wires);
  if (
    typeof base === "string" &&
    arranging &&
    new Date(row.updated_at).getTime() !== Date.parse(base)
  ) {
    return {
      body: {
        code: "stale",
        error:
          "This board was changed in another tab or window since this one loaded it.",
      },
      status: 409,
    };
  }
  return null;
}
