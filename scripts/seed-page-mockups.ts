/**
 * seed-page-mockups.ts - put every exported InDesign page on a board, each
 * wired to its own mockup node, and keep them linked so a re-export updates
 * the board in place.
 *
 *   SITE=dallas-images pnpm tsx scripts/seed-page-mockups.ts <pages-folder> \
 *     --board <uuid> [--trim 6x9] [--template book-front] [--replace]
 *
 * WHY THIS IS NOT seed-cover-board.ts. That one takes the layered PARTS of a
 * single artwork and builds one pipeline. This takes the FLAT PAGES that
 * BuildPages exports - one per cover concept - and builds one row per page.
 *
 * WHAT MAKES IT A LINK. Every item carries "page:<label>" in its body, where
 * the label comes from the PNG filename, which BuildPages derives from the
 * page itself. On a second run an existing row is UPDATED rather than
 * recreated, so the node you dragged stays where you put it and the wire you
 * drew survives. Only --replace clears the board, and it is never the default:
 * losing a hand-arranged board to a routine re-export is not an update.
 */
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { put } from "@vercel/blob";
import pg from "pg";
import sharp from "sharp";
import { loadEnv } from "./loadEnv.js";

const NODE_W = 260;
const NODE_H = 180;
const GAP = 60;
const PAGE_W = 520; // board units for the page thumbnail; height follows aspect

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};
const has = (flag: string): boolean => process.argv.indexOf(flag) !== -1;

/** "03-centrifuge-valley-seed12345.png" -> "03-centrifuge-valley-seed12345" */
const PNG = /\.png$/i;

const labelOf = (file: string): string => basename(file).replace(PNG, "");

interface Existing {
  body: string | null;
  id: string;
  kind: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: a one-shot seed script read top to bottom; splitting it hides the order the rows are written in
const main = async (): Promise<void> => {
  loadEnv();

  const { 2: folder } = process.argv;
  if (!folder || folder.startsWith("--")) {
    throw new Error(
      "Usage: seed-page-mockups.ts <pages-folder> --board <uuid> [--replace]"
    );
  }
  const board = arg("--board");
  if (!(board && UUID_RE.test(board))) {
    throw new Error("--board <uuid> is required");
  }
  const trim = arg("--trim") ?? "6x9";
  // "book-front" is the Face-up mockup: a single cover, straight on. That is
  // what an exported InDesign PAGE is. The old default, book-soft-02, is the
  // softcover front-AND-back template - it wants a full wrap, so feeding it a
  // one-page cover renders the wrong thing every time.
  const template = arg("--template") ?? "book-front";
  const KNOWN = new Set([
    "book-front",
    "book-tilt",
    "book-stack",
    "book-open",
    "book-soft-02",
    "book-soft-04",
    "book-soft-05",
  ]);
  if (!KNOWN.has(template)) {
    // Fail loudly. An unknown id used to sail through and produce a node the
    // canvas could not render, which looks identical to a broken board.
    throw new Error(
      `Unknown --template "${template}". Known: ${[...KNOWN].join(", ")}\n` +
        "  book-front      Face up - a single cover, straight on (default)\n" +
        "  book-soft-02    Softcover, front and back - needs a WRAP, not a page"
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to upload the pages");
  }

  const root = resolve(folder);
  const files = (await readdir(root)).filter((f) => PNG.test(f)).sort();
  if (files.length === 0) {
    throw new Error(`No .png pages in ${root} - run BuildPages first`);
  }
  process.stdout.write(`${files.length} page(s) from ${root}\n`);

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");

    const found = await client.query<{ id: string }>(
      "SELECT id FROM boards WHERE id = $1",
      [board]
    );
    if (!found.rows[0]) {
      throw new Error(`No board ${board}`);
    }

    if (has("--replace")) {
      await client.query("DELETE FROM board_wires WHERE board_id = $1", [
        board,
      ]);
      await client.query("DELETE FROM board_items WHERE board_id = $1", [
        board,
      ]);
      process.stdout.write("  --replace: cleared the board\n");
    }

    const prior = (
      await client.query<Existing>(
        "SELECT id, kind, body FROM board_items WHERE board_id = $1",
        [board]
      )
    ).rows;
    const byBody = new Map<string, Existing>();
    for (const row of prior) {
      if (row.body) {
        byBody.set(row.body, row);
      }
    }

    let z = prior.length;
    let added = 0;
    let updated = 0;

    for (const [i, file] of files.entries()) {
      const label = labelOf(file);
      // biome-ignore lint/performance/noAwaitInLoops: one upload at a time is polite to the blob store
      const buf = await readFile(join(root, file));
      const meta = await sharp(buf).metadata();
      const w = meta.width ?? 1800;
      const h = meta.height ?? 2700;
      const itemW = PAGE_W;
      const itemH = Math.round((h / w) * PAGE_W);

      // A STABLE blob path, so the board is not littered with one orphan per
      // publish - and a version marker on the URL we store, because an
      // overwritten blob keeps its address and a cached browser would happily
      // show yesterday's cover.
      const blob = await put(`boards/pages/${board}/${label}.png`, buf, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/png",
      });
      const url = `${blob.url}?v=${Date.now()}`;

      const pageKey = `page:${label}`;
      const mockKey = `mockup:${label}`;
      const y = i * (Math.max(itemH, NODE_H) + GAP);

      const existingPage = byBody.get(pageKey);
      if (existingPage) {
        // Keep x/y/z: this board has been arranged by hand.
        await client.query(
          `UPDATE board_items SET image_url = $1, thumb_url = $1,
             width = $2, height = $3 WHERE id = $4`,
          [url, itemW, itemH, existingPage.id]
        );
        updated += 1;
        continue;
      }

      const pageId = randomUUID();
      const mockId = randomUUID();
      await client.query(
        `INSERT INTO board_items
           (id, board_id, kind, image_url, thumb_url, body, node_type, config,
            x, y, width, height, z_index)
         VALUES ($1,$2,'reference',$3,$3,$4,NULL,NULL,$5,$6,$7,$8,$9)`,
        [pageId, board, url, pageKey, 0, y, itemW, itemH, z]
      );
      z += 1;
      await client.query(
        `INSERT INTO board_items
           (id, board_id, kind, image_url, thumb_url, body, node_type, config,
            x, y, width, height, z_index)
         VALUES ($1,$2,'op',NULL,NULL,$3,'mockup',$4::jsonb,$5,$6,$7,$8,$9)`,
        [
          mockId,
          board,
          mockKey,
          JSON.stringify({ template, trim }),
          itemW + GAP,
          y,
          NODE_W,
          NODE_H,
          z,
        ]
      );
      z += 1;
      await client.query(
        `INSERT INTO board_wires
           (id, board_id, source_item_id, source_port, target_item_id, target_port)
         VALUES ($1,$2,$3,'out',$4,'cover')`,
        [randomUUID(), board, pageId, mockId]
      );
      added += 1;
      process.stdout.write(`  + ${label}\n`);
    }

    await client.query("COMMIT");
    process.stdout.write(
      `\n${added} page(s) added, ${updated} updated.\n` +
        `Board ready: /admin/boards/${board}\nOpen it and press Run.\n`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
