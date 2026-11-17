import { and, isNull, sql } from "drizzle-orm";
import { describeWithClaude } from "./claudeVision.js";
import { getDb, schema } from "./orm.js";

/**
 * Images described once, in words and colours, so a library can be searched
 * the way people look for references: "warm amber", "brutalist type",
 * "#041045", "moody interior".
 *
 * A photo and a collection item each get a short description (mood, style,
 * subject, setting, materials) and up to six dominant colours. Written by
 * Claude Haiku (claudeVision.ts) after a save, and for what was saved
 * before by repeating `describePending` until nothing is left.
 */

const SYSTEM =
  "You catalogue visual references for a designer. Reply with JSON only, no prose and no code fence.";

const PROMPT = `Describe this image for search. Return {"description": string, "colors": string[]}.
description: 25-60 words, comma-separated phrases: the mood, the visual style or movement, the subject, setting, materials, lighting, typography if any, and the medium (photo, 3D render, illustration, poster, packaging, UI…). Plain words people would search with.
colors: its 3-6 most prominent colours as lower-case #rrggbb, most prominent first.`;

const HEX = /^#[0-9a-f]{6}$/;
const MAX_DESCRIPTION = 600;
/** Per call to describePending: inside a function's time, a few at once. */
const BATCH = 8;
const AT_ONCE = 4;

export interface ImageDescription {
  colors: string[];
  description: string;
}

/** The model's reply as a description, or null when it isn't one. */
export const parseDescription = (reply: string): ImageDescription | null => {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const raw = JSON.parse(reply.slice(start, end + 1)) as {
      colors?: unknown;
      description?: unknown;
    };
    const description =
      typeof raw.description === "string"
        ? raw.description.trim().slice(0, MAX_DESCRIPTION)
        : "";
    const colors = (Array.isArray(raw.colors) ? raw.colors : [])
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim().toLowerCase())
      .filter((c) => HEX.test(c))
      .slice(0, 6);
    return description ? { colors, description } : null;
  } catch {
    return null;
  }
};

export const describeImage = async (
  url: string
): Promise<ImageDescription | null> =>
  parseDescription(await describeWithClaude([url], SYSTEM, PROMPT));

interface Pending {
  id: string;
  table: "items" | "photos";
  url: string;
}

/** Images not yet described: collection items first (the references). */
const pendingImages = async (limit: number): Promise<Pending[]> => {
  const db = getDb();
  const items = await db
    .select({ id: schema.collectionItems.id, url: schema.collectionItems.url })
    .from(schema.collectionItems)
    .where(
      and(
        isNull(schema.collectionItems.aiDescription),
        sql`${schema.collectionItems.kind} = 'image'`
      )
    )
    .limit(limit);
  const photos =
    items.length < limit
      ? await db
          .select({ id: schema.photos.id, url: schema.photos.url })
          .from(schema.photos)
          .where(isNull(schema.photos.aiDescription))
          .limit(limit - items.length)
      : [];
  return [
    ...items.map((r) => ({ ...r, table: "items" as const })),
    ...photos.map((r) => ({ ...r, table: "photos" as const })),
  ];
};

const store = async (image: Pending, found: ImageDescription | null) => {
  // An image that can't be read is marked with an empty description, so it
  // isn't tried again on every pass; its title still finds it.
  const values = {
    aiDescription: found?.description ?? "",
    colors: found?.colors ?? [],
  };
  const db = getDb();
  if (image.table === "items") {
    await db
      .update(schema.collectionItems)
      .set(values)
      .where(sql`${schema.collectionItems.id} = ${image.id}`);
  } else {
    await db
      .update(schema.photos)
      .set(values)
      .where(sql`${schema.photos.id} = ${image.id}`);
  }
};

/** How many images are still waiting to be described. */
export const pendingCount = async (): Promise<number> => {
  const db = getDb();
  const [items] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.collectionItems)
    .where(
      and(
        isNull(schema.collectionItems.aiDescription),
        sql`${schema.collectionItems.kind} = 'image'`
      )
    );
  const [photos] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.photos)
    .where(isNull(schema.photos.aiDescription));
  return (items?.n ?? 0) + (photos?.n ?? 0);
};

/** Describes the next few undescribed images; says how many are left. */
export const describePending = async (): Promise<{
  described: number;
  left: number;
}> => {
  const batch = await pendingImages(BATCH);
  let described = 0;
  for (let i = 0; i < batch.length; i += AT_ONCE) {
    // biome-ignore lint/performance/noAwaitInLoops: a few at a time, to stay inside the model's rate and the function's time
    await Promise.all(
      batch.slice(i, i + AT_ONCE).map(async (image) => {
        // Claude refusing the image (400: unreadable, too large) is an
        // answer; anything else (not configured, busy, offline) is tried
        // again on the next pass rather than marked done.
        const outcome = await describeImage(image.url).then(
          (found) => ({ found }),
          (err: unknown) =>
            String(err).includes("(400)") ? { found: null } : null
        );
        if (!outcome) {
          return;
        }
        await store(image, outcome.found);
        if (outcome.found) {
          described += 1;
        }
      })
    );
  }
  return { described, left: await pendingCount() };
};
