import { desc, eq } from "drizzle-orm";
import type { BrandKitDoc } from "../../config/brandKit.js";
import {
  EMPTY_KIT,
  inheritedParts,
  resolveKitDoc,
  sanitizeKitDoc,
} from "../../config/brandKit.js";
import {
  withLinkedComponents,
  withLinkedPalette,
} from "../../config/kitComponentLink.js";
import type { getSql } from "./db.js";
import { getDb, schema } from "./orm.js";
import { toIso } from "./timestamps.js";

/**
 * Reading and writing brand kits.
 *
 * The same division as recipeStore (030): SQL here, rules in config, handlers
 * thin. What is particular to a kit is that **a version is never updated**.
 * Editing writes a new row and moves the pointer, which is what lets an asset
 * made in March keep showing the kit as it stood in March — see patch 031.
 */

type Sql = ReturnType<typeof getSql>;

export interface BrandKitRow {
  created_at: string | Date;
  current_version: number | null;
  current_version_id: string | null;
  doc: unknown;
  id: string;
  name: string;
  parent_doc: unknown;
  parent_id: string | null;
  parent_name: string | null;
  updated_at: string | Date;
  version_count: number | string;
}

export interface BrandKitDto {
  createdAt: string;
  /** The kit's *own* document. `EMPTY_KIT` when no version exists yet. */
  doc: BrandKitDoc;
  id: string;
  /** Which parts of `resolvedDoc` came from the parent rather than this kit. */
  inherited: string[];
  name: string;
  parentId: string | null;
  parentName: string | null;
  /**
   * What this kit actually means, parent included.
   *
   * Sent alongside the kit's own document rather than instead of it: the editor
   * has to show what a sub-brand states, and everything else wants what it
   * resolves to. Computed here so the panel and the run path cannot disagree.
   */
  resolvedDoc: BrandKitDoc;
  updatedAt: string;
  /** Which version `doc` came from, so a caller can pin what it read. */
  version: number | null;
  versionCount: number;
  versionId: string | null;
}

/**
 * Sanitised on the way *out* as well as in.
 *
 * A row written before a limit changed would otherwise hand the panel a
 * document it refuses to save back, which reads as the editor being broken.
 */
export const rowToKitDto = (row: BrandKitRow): BrandKitDto => {
  const own = row.current_version_id ? sanitizeKitDoc(row.doc) : EMPTY_KIT;
  const parent = row.parent_id ? sanitizeKitDoc(row.parent_doc) : null;
  return {
    createdAt: toIso(row.created_at),
    doc: own,
    id: row.id,
    inherited: inheritedParts(own, parent),
    name: row.name,
    parentId: row.parent_id,
    parentName: row.parent_name,
    resolvedDoc: resolveKitDoc(own, parent),
    updatedAt: toIso(row.updated_at),
    version: row.current_version,
    versionCount: Number(row.version_count) || 0,
    versionId: row.current_version_id,
  };
};

/*
 * Three queries below stay on the raw driver, deliberately.
 *
 * `loadKits` and `loadKit` join brand_kits to itself twice — once for the
 * parent's name and once for the parent's *current* version — alongside a
 * correlated count and an ORDER BY over COALESCE(parent, own) with an explicit
 * NULLS FIRST. Every one of those is expressible in Drizzle; the self-aliasing
 * is also exactly where a mistake would go unnoticed, because the result is
 * plausible data rather than an error.
 *
 * `writeKitVersion` is the one that must not move without care. Its version
 * number comes from `COALESCE(MAX(version), 0) + 1` *inside* the INSERT, which
 * is the whole guard against two saves claiming the same number. Computing it
 * in JavaScript first would open exactly the race the statement exists to
 * close, and the failure would be a unique-constraint error on a save that
 * looked fine in testing.
 *
 * The read path here is converted; these are not, and that is a judgement
 * rather than an omission.
 */

/**
 * Every kit, newest first, each with its current version inlined.
 *
 * One query rather than a list plus a fetch per kit: a kit is small, bounded by
 * config/brandKit.ts, and the panel shows the palette on the card — so the
 * document is wanted every time the list is.
 */
export const loadKits = async (sql: Sql): Promise<BrandKitDto[]> => {
  const rows = (await sql`
    SELECT
      k.id,
      k.name,
      k.created_at,
      k.updated_at,
      k.current_version_id,
      k.parent_id,
      p.name      AS parent_name,
      pv.doc      AS parent_doc,
      v.version   AS current_version,
      v.doc       AS doc,
      (SELECT COUNT(*) FROM brand_kit_versions c WHERE c.brand_kit_id = k.id)
        AS version_count
    FROM brand_kits k
    LEFT JOIN brand_kit_versions v ON v.id = k.current_version_id
    /* The parent's *current* version, which is what a sub-brand inherits from —
       pinning a sub-brand to a particular parent version would mean two
       version histories to reason about, and the question this feature answers
       is "what does this brand mean now". */
    LEFT JOIN brand_kits k_parent ON k_parent.id = k.parent_id
    LEFT JOIN brand_kits p ON p.id = k.parent_id
    LEFT JOIN brand_kit_versions pv ON pv.id = k_parent.current_version_id
    ORDER BY COALESCE(p.updated_at, k.updated_at) DESC, k.parent_id NULLS FIRST, k.updated_at DESC
  `) as BrandKitRow[];
  const kits = rows.map(rowToKitDto);
  const byId = new Map(kits.map((kit) => [kit.id, kit]));
  return kits.map((kit) => linkComponents(kit, byId));
};

/**
 * A kit following another's palette or components (config/kitComponentLink.ts)
 * with them in: one hop, from each source's own resolved document, never
 * itself. The palette first, so linked styles carry into these colours.
 */
const linkComponents = (
  kit: BrandKitDto,
  byId: Map<string, BrandKitDto>
): BrandKitDto => {
  const sourceOf = (from: string | null) =>
    from && from !== kit.id ? byId.get(from) : undefined;
  const palette = sourceOf(kit.resolvedDoc.paletteFrom);
  const components = sourceOf(kit.resolvedDoc.componentsFrom);
  if (!(palette || components)) {
    return kit;
  }
  const coloured = withLinkedPalette(
    kit.doc,
    kit.resolvedDoc,
    palette?.resolvedDoc ?? null
  );
  return {
    ...kit,
    resolvedDoc: withLinkedComponents(
      kit.doc,
      coloured,
      components?.resolvedDoc ?? null
    ),
  };
};

export const loadKit = async (
  sql: Sql,
  id: string
): Promise<BrandKitDto | null> => {
  const rows = (await sql`
    SELECT
      k.id,
      k.name,
      k.created_at,
      k.updated_at,
      k.current_version_id,
      k.parent_id,
      p.name      AS parent_name,
      pv.doc      AS parent_doc,
      v.version   AS current_version,
      v.doc       AS doc,
      (SELECT COUNT(*) FROM brand_kit_versions c WHERE c.brand_kit_id = k.id)
        AS version_count
    FROM brand_kits k
    LEFT JOIN brand_kit_versions v ON v.id = k.current_version_id
    /* The parent's *current* version, which is what a sub-brand inherits from —
       pinning a sub-brand to a particular parent version would mean two
       version histories to reason about, and the question this feature answers
       is "what does this brand mean now". */
    LEFT JOIN brand_kits k_parent ON k_parent.id = k.parent_id
    LEFT JOIN brand_kits p ON p.id = k.parent_id
    LEFT JOIN brand_kit_versions pv ON pv.id = k_parent.current_version_id
    WHERE k.id = ${id}
  `) as BrandKitRow[];
  const [row] = rows;
  if (!row) {
    return null;
  }
  const kit = rowToKitDto(row);
  const wanted = [
    kit.doc.palette.length === 0 ? kit.resolvedDoc.paletteFrom : null,
    kit.doc.componentStyles.length === 0
      ? kit.resolvedDoc.componentsFrom
      : null,
  ].filter((from): from is string => Boolean(from) && from !== id);
  if (wanted.length === 0) {
    return kit;
  }
  // Not through loadKit again: one hop, so two kits linked to each other
  // can't go round.
  const sourceRows = (await sql`
    SELECT k.id, k.name, k.created_at, k.updated_at, k.current_version_id,
      k.parent_id, p.name AS parent_name, pv.doc AS parent_doc,
      v.version AS current_version, v.doc AS doc, 0 AS version_count
    FROM brand_kits k
    LEFT JOIN brand_kit_versions v ON v.id = k.current_version_id
    LEFT JOIN brand_kits p ON p.id = k.parent_id
    LEFT JOIN brand_kit_versions pv ON pv.id = p.current_version_id
    WHERE k.id = ANY(${[...new Set(wanted)]}::uuid[])
  `) as BrandKitRow[];
  const sources = sourceRows.map(rowToKitDto);
  return linkComponents(kit, new Map(sources.map((src) => [src.id, src])));
};

/** A kit's history, newest first — what "which version was this made against"
 *  is answered from. The documents come too: they are small, and a history
 *  nobody can read the contents of is a list of numbers. */
export const loadKitVersions = async (kitId: string) => {
  const rows = await getDb()
    .select({
      created_at: schema.brandKitVersions.createdAt,
      doc: schema.brandKitVersions.doc,
      id: schema.brandKitVersions.id,
      version: schema.brandKitVersions.version,
    })
    .from(schema.brandKitVersions)
    .where(eq(schema.brandKitVersions.brandKitId, kitId))
    .orderBy(desc(schema.brandKitVersions.version));
  return rows.map((row) => ({
    createdAt: toIso(row.created_at),
    doc: sanitizeKitDoc(row.doc),
    id: row.id,
    version: row.version,
  }));
};

/**
 * Writes a new version and points the kit at it.
 *
 * The version number is taken inside the same statement that inserts it, so two
 * saves racing cannot both claim the same number — the unique constraint on
 * (brand_kit_id, version) would reject the loser, which is the right outcome but
 * a worse error than not racing. `COALESCE(MAX(version), 0) + 1` in the INSERT
 * is the whole guard.
 */
export const writeKitVersion = async (
  sql: Sql,
  kitId: string,
  doc: BrandKitDoc
) => {
  const inserted = (await sql`
    INSERT INTO brand_kit_versions (brand_kit_id, version, doc)
    SELECT
      ${kitId}::uuid,
      COALESCE(MAX(version), 0) + 1,
      ${JSON.stringify(doc)}::jsonb
    FROM brand_kit_versions
    WHERE brand_kit_id = ${kitId}
    RETURNING id, version
  `) as { id: string; version: number }[];
  const [row] = inserted;
  if (!row) {
    return null;
  }
  await sql`
    UPDATE brand_kits
    SET current_version_id = ${row.id}, updated_at = NOW()
    WHERE id = ${kitId}
  `;
  return row;
};

/** How long a version stays open to the edits that follow it. */
export const DRAFT_WINDOW_MINUTES = 30;

/**
 * An edit from the editor, which saves itself a moment after each change.
 *
 * Writing a version per change would bury the history under one version per
 * keystroke, so a change folds into the kit's current version while that
 * version is still a working draft: the latest one, made in the last
 * DRAFT_WINDOW_MINUTES, and not yet used. "Used" is anything that recorded
 * this version's id — a verdict (brand_verdicts) or a board run's stamp
 * (board_items.result / config) — because each of those claims "made against
 * this document", and that document must not change under it. Otherwise a
 * new version is written, as a deliberate save always was.
 */
export const writeKitEdit = async (
  sql: Sql,
  kitId: string,
  doc: BrandKitDoc
) => {
  const folded = (await sql`
    UPDATE brand_kit_versions v
    SET doc = ${JSON.stringify(doc)}::jsonb
    FROM brand_kits k
    WHERE k.id = ${kitId}::uuid
      AND v.id = k.current_version_id
      AND v.version = (
        SELECT MAX(version) FROM brand_kit_versions
        WHERE brand_kit_id = ${kitId}::uuid
      )
      AND v.created_at > NOW() - make_interval(mins => ${DRAFT_WINDOW_MINUTES}::int)
      AND NOT EXISTS (
        SELECT 1 FROM brand_verdicts b WHERE b.brand_kit_version_id = v.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM board_items i
        WHERE position(
          v.id::text IN coalesce(i.result::text, '') || coalesce(i.config::text, '')
        ) > 0
      )
    RETURNING v.id, v.version
  `) as { id: string; version: number }[];
  const [row] = folded;
  if (!row) {
    return writeKitVersion(sql, kitId, doc);
  }
  await sql`UPDATE brand_kits SET updated_at = NOW() WHERE id = ${kitId}`;
  return row;
};
