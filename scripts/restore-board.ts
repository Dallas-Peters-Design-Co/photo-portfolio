/**
 * restore-board.ts - copy ONE board's contents back from a point-in-time
 * branch into the live database.
 *
 *   SITE=dallas-images pnpm tsx scripts/restore-board.ts \
 *     --board <uuid> --from "<connection string of the PITR branch>" [--apply]
 *
 * Without --apply it only reports what it WOULD restore. Nothing is written
 * until you have read that and asked for it - which is the opposite of how the
 * board came to be overwritten in the first place.
 *
 * It restores board_items and board_wires for the one board, and the board's
 * title. It does not touch any other board or any other table.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadEnv } from "./loadEnv.js";

const arg = (f: string): string | undefined => {
  const i = process.argv.indexOf(f);
  return i === -1 ? undefined : process.argv[i + 1];
};
const has = (f: string): boolean => process.argv.indexOf(f) !== -1;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const main = async (): Promise<void> => {
  loadEnv();
  const board = arg("--board");
  const from = arg("--from");
  const apply = has("--apply");
  if (!(board && UUID_RE.test(board))) {
    throw new Error("--board <uuid> is required");
  }
  if (!from) {
    throw new Error(
      "--from <connection string of the restore branch> is required"
    );
  }
  const live = process.env.DATABASE_URL;
  if (!live) {
    throw new Error("DATABASE_URL is required (the live database)");
  }

  const src = new pg.Client({ connectionString: from });
  const dst = new pg.Client({ connectionString: live });
  await src.connect();
  await dst.connect();
  try {
    const oldBoard = await src.query<{ title: string; slug: string | null }>(
      "SELECT title, slug FROM boards WHERE id = $1",
      [board]
    );
    if (!oldBoard.rows[0]) {
      throw new Error(`The restore branch has no board ${board}`);
    }
    const items = await src.query(
      `SELECT id, kind, image_url, thumb_url, body, node_type, config,
              x, y, width, height, z_index
         FROM board_items WHERE board_id = $1 ORDER BY z_index ASC`,
      [board]
    );
    const wires = await src.query(
      `SELECT id, source_item_id, source_port, target_item_id, target_port
         FROM board_wires WHERE board_id = $1`,
      [board]
    );
    const now = await dst.query(
      "SELECT count(*)::int AS n FROM board_items WHERE board_id = $1",
      [board]
    );

    process.stdout.write(
      `\nRestore branch has: "${oldBoard.rows[0].title}"  ` +
        `${items.rowCount} item(s), ${wires.rowCount} wire(s)\n` +
        `Live board has now: ${now.rows[0].n} item(s)\n`
    );
    if (!apply) {
      process.stdout.write("\nDry run. Add --apply to write this back.\n");
      return;
    }

    await dst.query("BEGIN");
    await dst.query("DELETE FROM board_wires WHERE board_id = $1", [board]);
    await dst.query("DELETE FROM board_items WHERE board_id = $1", [board]);
    for (const r of items.rows) {
      // biome-ignore lint/performance/noAwaitInLoops: one board's worth of rows
      await dst.query(
        `INSERT INTO board_items
           (id, board_id, kind, image_url, thumb_url, body, node_type, config,
            x, y, width, height, z_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)`,
        [
          r.id,
          board,
          r.kind,
          r.image_url,
          r.thumb_url,
          r.body,
          r.node_type,
          r.config === null ? null : JSON.stringify(r.config),
          r.x,
          r.y,
          r.width,
          r.height,
          r.z_index,
        ]
      );
    }
    for (const w of wires.rows) {
      // biome-ignore lint/performance/noAwaitInLoops: one board's worth of rows
      await dst.query(
        `INSERT INTO board_wires
           (id, board_id, source_item_id, source_port, target_item_id, target_port)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          w.id ?? randomUUID(),
          board,
          w.source_item_id,
          w.source_port,
          w.target_item_id,
          w.target_port,
        ]
      );
    }
    await dst.query("UPDATE boards SET title = $1 WHERE id = $2", [
      oldBoard.rows[0].title,
      board,
    ]);
    await dst.query("COMMIT");
    process.stdout.write(
      `\nRestored ${items.rowCount} item(s) and ${wires.rowCount} wire(s).\n`
    );
  } catch (error) {
    try {
      await dst.query("ROLLBACK");
    } catch {
      /* not in a transaction */
    }
    throw error;
  } finally {
    await src.end();
    await dst.end();
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
