import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { put } from "@vercel/blob";
import pg from "pg";
import sharp from "sharp";
import { loadEnv } from "./loadEnv.js";

/**
 * A book's cover parts, laid out on a board as the whole pipeline.
 *
 *   pnpm cover:seed "<parts folder>" --variant poster --book "<book.json>"
 *
 * Takes the `parts/` folder the cover work exports — full-frame PNGs with
 * alpha and an index.json saying where each one's pixels are — and makes a
 * board that is ready to run: a frame with every part on it at its place and
 * in its stacking order, wired into Composite → Cover → Print wrap → Mockup,
 * with the book's title, subtitle, author and page count already on the
 * nodes. Open it, press Run, and the mockup comes out the far end.
 *
 * Each part is cropped to its opaque bounds before upload. A board draws a
 * picture to cover the box it sits in, so a full-frame PNG placed at its
 * bounding box would be squeezed; cropped, the box *is* the picture, and the
 * composite puts it back exactly where the PSD had it.
 *
 * Written straight to the database rather than through the API because the
 * API needs a signed-in browser and this runs from a terminal — the same
 * arrangement db:seed and lora:upload use. It reads DATABASE_URL and
 * BLOB_READ_WRITE_TOKEN from .env like they do, which means it writes to
 * whatever database the app is pointed at. Re-running with the same book
 * makes a second board rather than touching the first: a board is a place
 * somebody has worked, and a script should not rearrange it.
 */

/** Canvas units per cover pixel. A 1800×2700 cover is a 600×900 frame. */
const SCALE = 1 / 3;

/** Parts that are words. Drawn by the Cover node, not placed as pixels. */
const TYPE_ROLES = new Set(["title-lockup", "author-text", "author-plate"]);

/** Where the pipeline nodes go, to the right of the frame. */
const NODE_W = 380;
const NODE_H = 460;
const GAP = 80;

interface Layer {
  bbox: [number, number, number, number];
  file: string;
  role: string;
}

interface Index {
  canvas: { height: number; width: number };
  variants: Record<string, { layers: Layer[] }>;
}

/**
 * A book, as _pipeline/schema/books/*.json in the project folder describes
 * it. Only the fields the nodes need; the rest of that schema (concept,
 * palette, outputs) is the design brief and stays where it is.
 */
interface Book {
  author?: string;
  print?: {
    blurb?: string;
    page_count?: number;
    paper?: string;
    trim_h_in?: number;
    trim_w_in?: number;
  };
  subtitle?: string;
  title?: string;
  variant?: string;
}

/** "6x9" from the schema's separate width and height. */
const trimOf = (book: Book): string => {
  const w = book.print?.trim_w_in;
  const h = book.print?.trim_h_in;
  return w && h ? `${w}x${h}` : "6x9";
};

const arg = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};

const main = async (): Promise<void> => {
  loadEnv();
  const folder = process.argv[2];
  if (!folder || folder.startsWith("--")) {
    throw new Error(
      'Usage: pnpm cover:seed "<parts folder>" [--variant poster] [--book book.json] [--title "Board title"] [--all-parts]'
    );
  }
  const bookPath = arg("--book");
  const book: Book = bookPath
    ? (JSON.parse(await readFile(resolve(bookPath), "utf8")) as Book)
    : {};
  const variant = arg("--variant") ?? book.variant ?? "poster";
  const allParts = process.argv.includes("--all-parts");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required (set in .env or .env.local)");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to upload the parts");
  }

  const root = resolve(folder);
  const index = JSON.parse(
    await readFile(join(root, "index.json"), "utf8")
  ) as Index;
  // The type parts stay off the frame: the Cover node sets the title, the
  // subtitle and the byline itself, from its settings, and a frame that also
  // carried them as pixels would print every word twice. `--all-parts` puts
  // them on anyway, for a board that wants the PSD's exact lockup and will
  // clear the Cover's own fields.
  const layers = index.variants[variant]?.layers.filter(
    (layer) => allParts || !TYPE_ROLES.has(layer.role)
  );
  if (!layers?.length) {
    throw new Error(`No "${variant}" variant in ${join(root, "index.json")}`);
  }
  const title =
    arg("--title") ?? `${book.title ?? basename(root)} — ${variant}`;

  // Upload every part, cropped to its box. Named by book and role so a
  // re-export with the same name replaces the file every board points at.
  const slug = (book.title ?? basename(root))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  process.stdout.write(`Uploading ${layers.length} parts…\n`);
  const uploaded: { layer: Layer; url: string }[] = [];
  for (const layer of layers) {
    const [x0, y0, x1, y1] = layer.bbox;
    // biome-ignore lint/performance/noAwaitInLoops: one upload at a time is polite to the blob store and the parts are a few megabytes each
    const cropped = await sharp(join(root, layer.file))
      .extract({ height: y1 - y0, left: x0, top: y0, width: x1 - x0 })
      .png()
      .toBuffer();
    const blob = await put(`boards/parts/${slug}/${variant}/${layer.role}.png`, cropped, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/png",
    });
    uploaded.push({ layer, url: blob.url });
    process.stdout.write(`  ${layer.role.padEnd(20)} ${x1 - x0}×${y1 - y0}\n`);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    const boardRes = await client.query<{ id: string }>(
      "INSERT INTO boards (title) VALUES ($1) RETURNING id",
      [title]
    );
    const boardId = boardRes.rows[0]?.id;
    if (!boardId) {
      throw new Error("Could not create the board");
    }

    const insertItem = async (item: {
      body?: string | null;
      config?: Record<string, unknown> | null;
      height: number;
      id: string;
      imageUrl?: string | null;
      kind: string;
      nodeType?: string | null;
      width: number;
      x: number;
      y: number;
      z: number;
    }) =>
      client.query(
        `INSERT INTO board_items
           (id, board_id, kind, image_url, thumb_url, body, node_type, config, x, y, width, height, z_index)
         VALUES ($1, $2, $3, $4, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12)`,
        [
          item.id,
          boardId,
          item.kind,
          item.imageUrl ?? null,
          item.body ?? null,
          item.nodeType ?? null,
          item.config === undefined || item.config === null
            ? null
            : JSON.stringify(item.config),
          item.x,
          item.y,
          item.width,
          item.height,
          item.z,
        ]
      );

    // The frame: the whole trim, at canvas scale, at the origin.
    const frame = {
      height: Math.round(index.canvas.height * SCALE),
      id: randomUUID(),
      width: Math.round(index.canvas.width * SCALE),
      x: 0,
      y: 0,
    };
    await insertItem({
      ...frame,
      body: `${book.title ?? basename(root)} parts`,
      kind: "frame",
      z: 0,
    });

    // The parts, in index order, which is bottom to top.
    let z = 1;
    for (const { layer, url } of uploaded) {
      const [x0, y0, x1, y1] = layer.bbox;
      // biome-ignore lint/performance/noAwaitInLoops: the HTTP driver has no batch, and a book has a dozen parts
      await insertItem({
        body: layer.role,
        height: Math.round((y1 - y0) * SCALE),
        id: randomUUID(),
        imageUrl: url,
        kind: "reference",
        width: Math.round((x1 - x0) * SCALE),
        x: Math.round(x0 * SCALE),
        y: Math.round(y0 * SCALE),
        z: z++,
      });
    }

    // The pipeline, left to right beside the frame.
    const nodeX = (i: number) => frame.width + GAP + i * (NODE_W + GAP);
    const nodes = [
      { config: { background: "transparent" }, nodeType: "composite" },
      {
        config: {
          author: book.author ?? "",
          subtitle: book.subtitle ?? "",
          title: book.title ?? "",
          variant,
        },
        nodeType: "cover",
      },
      {
        config: {
          author: book.author ?? "",
          copy: book.print?.blurb ?? "",
          pages: book.print?.page_count ? String(book.print.page_count) : "",
          paper: book.print?.paper ?? "cream",
          title: book.title ?? "",
          trim: trimOf(book),
        },
        nodeType: "wrap",
      },
      {
        config: { template: "book-soft-02", trim: trimOf(book) },
        nodeType: "mockup",
      },
    ].map((node, i) => ({
      ...node,
      height: NODE_H,
      id: randomUUID(),
      kind: "op",
      width: NODE_W,
      x: nodeX(i),
      y: 0,
      z: z + i,
    }));
    for (const node of nodes) {
      // biome-ignore lint/performance/noAwaitInLoops: four rows
      await insertItem(node);
    }

    const [composite, cover, wrap, mockup] = nodes;
    const wires = [
      [frame.id, "out", composite.id, "image"],
      [composite.id, "out", cover.id, "art"],
      [cover.id, "out", wrap.id, "front"],
      [cover.id, "out", mockup.id, "cover"],
      [wrap.id, "out", mockup.id, "wrap"],
    ];
    for (const [from, fromPort, to, toPort] of wires) {
      // biome-ignore lint/performance/noAwaitInLoops: five rows
      await client.query(
        `INSERT INTO board_wires (id, board_id, source_item_id, source_port, target_item_id, target_port)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), boardId, from, fromPort, to, toPort]
      );
    }

    await client.query("COMMIT");
    process.stdout.write(
      `\nBoard "${title}" is ready: /admin/boards/${boardId}\nOpen it and press Run.\n`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
