import {
  cleanConceptStyles,
  MAX_CONCEPT_STYLES,
} from "../../config/conceptStyle.js";
import type { BrandKitDto } from "./brandKitStore.js";
import type { getSql } from "./db.js";

/** Change just the styles in a new kit version, preserving the rest of the stored document. */
export async function saveKitComponentStyle(
  sql: ReturnType<typeof getSql>,
  kit: BrandKitDto,
  input: unknown
) {
  const [style] = cleanConceptStyles([input]);
  if (!style) {
    return { error: "Invalid component style", status: 400 };
  }
  const styles = kit.resolvedDoc.componentStyles;
  const index = styles.findIndex((item) => item.id === style.id);
  if (index < 0 && styles.length >= MAX_CONCEPT_STYLES) {
    return {
      error: "The kit has reached its component style limit.",
      status: 400,
    };
  }
  const next = styles.slice();
  next[index < 0 ? next.length : index] = style;
  const saved = await sql`
    WITH current_kit AS (
      SELECT id, current_version_id FROM brand_kits
      WHERE id = ${kit.id} AND current_version_id IS NOT DISTINCT FROM ${kit.versionId}::uuid
        AND date_trunc('milliseconds', updated_at) = ${kit.updatedAt}::timestamptz
      FOR UPDATE
    ), added AS (
      INSERT INTO brand_kit_versions (brand_kit_id, version, doc)
      SELECT k.id, (SELECT coalesce(max(version),0)+1 FROM brand_kit_versions WHERE brand_kit_id=k.id),
        jsonb_set(coalesce(v.doc, '{}'::jsonb), '{componentStyles}', ${JSON.stringify(next)}::jsonb)
      FROM current_kit k LEFT JOIN brand_kit_versions v ON v.id=k.current_version_id
      ON CONFLICT (brand_kit_id,version) DO NOTHING
      RETURNING id, brand_kit_id
    )
    UPDATE brand_kits k SET current_version_id=added.id, updated_at=now()
    FROM added WHERE k.id=added.brand_kit_id RETURNING k.id`;
  return saved.length
    ? null
    : {
        error: "The kit changed while saving. Try saving the style again.",
        status: 409,
      };
}
