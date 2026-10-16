import type { VercelRequest, VercelResponse } from "@vercel/node";
import { MAX_CLIENT_NAME } from "../../config/proposal.js";
import {
  DEFAULT_REVIEW_DOC,
  MAX_REVIEW_TITLE,
  sanitizeReviewDoc,
} from "../../config/review.js";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";
import { sanitizeText } from "../_lib/httpUrl.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import { cleanEmail, normalizeProposalSlug } from "../_lib/proposals.js";
import {
  isReviewStatus,
  REVIEW_SELECT,
  type ReviewRow,
  rowToReviewDto,
  rowToReviewSummary,
} from "../_lib/reviews.js";

/** The reviews: what exists, and making a new one. Admin only. */

type Sql = ReturnType<typeof getSql>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  const user = getBearerUser(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const sql = getSql();
    if (req.method === "GET") {
      const rows = (await sql`
        SELECT ${sql.unsafe(REVIEW_SELECT)}
        ORDER BY r.updated_at DESC
      `) as ReviewRow[];
      return res.status(200).json(rows.map(rowToReviewSummary));
    }
    if (req.method === "POST") {
      return await create(sql, user.userId, req, res);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes('relation "reviews"')) {
      return res.status(503).json({
        error:
          "Database schema is out of date. Run pnpm db:migrate against this deployment.",
      });
    }
    return res.status(500).json({ error: "Could not load reviews" });
  }
}

async function create(
  sql: Sql,
  userId: string,
  req: VercelRequest,
  res: VercelResponse
) {
  const body = parseJsonBody(req.body);
  const title =
    typeof body.title === "string"
      ? sanitizeText(body.title).slice(0, MAX_REVIEW_TITLE)
      : "";
  if (!title) {
    return res.status(400).json({ error: "A title is required" });
  }
  const slugCheck = normalizeProposalSlug(body.slug);
  if (!slugCheck.ok) {
    return res.status(400).json({ error: slugCheck.error });
  }
  const clientName =
    typeof body.clientName === "string"
      ? sanitizeText(body.clientName).slice(0, MAX_CLIENT_NAME)
      : "";
  const clientEmail = cleanEmail(body.clientEmail);
  const status = isReviewStatus(body.status) ? body.status : "draft";
  const doc = sanitizeReviewDoc(body.doc ?? DEFAULT_REVIEW_DOC);
  const brandKitId =
    typeof body.brandKitId === "string" && body.brandKitId
      ? body.brandKitId
      : null;

  const existing = (await sql`
    SELECT id FROM reviews WHERE slug = ${slugCheck.slug} LIMIT 1
  `) as { id: string }[];
  if (existing.length > 0) {
    return res.status(409).json({ error: "That address is already taken" });
  }
  const inserted = (await sql`
    INSERT INTO reviews (slug, title, client_name, client_email, brand_kit_id, doc, status, updated_by)
    VALUES (${slugCheck.slug}, ${title}, ${clientName}, ${clientEmail}, ${brandKitId}, ${JSON.stringify(doc)}::jsonb, ${status}, ${userId})
    RETURNING id
  `) as { id: string }[];
  const [row] = (await sql`
    SELECT ${sql.unsafe(REVIEW_SELECT)}
    WHERE r.id = ${inserted[0]?.id ?? ""}
  `) as ReviewRow[];
  return res.status(201).json(row ? rowToReviewDto(row) : null);
}
