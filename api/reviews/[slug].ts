import type { VercelRequest, VercelResponse } from "@vercel/node";
import { MAX_CLIENT_NAME } from "../../config/proposal.js";
import { MAX_REVIEW_TITLE, sanitizeReviewDoc } from "../../config/review.js";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";
import { sanitizeText } from "../_lib/httpUrl.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import { cleanEmail, normalizeProposalSlug } from "../_lib/proposals.js";
import {
  accessOf,
  keepPrivate,
  passFor,
  passOf,
  passValid,
  passwordMatches,
  passwordProblem,
} from "../_lib/reviewAccess.js";
import {
  isReviewStatus,
  REVIEW_SELECT,
  type ReviewRow,
  rowToReviewDto,
} from "../_lib/reviews.js";

/**
 * One review, by address: public once published, a draft only while signed
 * in. The public response is noindex; a review is for one client.
 *
 * A review with a password answers a visitor with only its title until they
 * send a pass (_lib/reviewAccess.ts), which POST { password } hands out.
 */

type Sql = ReturnType<typeof getSql>;

const loadBySlug = async (sql: Sql, slug: string) => {
  const rows = (await sql`
    SELECT ${sql.unsafe(REVIEW_SELECT)}
    WHERE r.slug = ${slug}
    LIMIT 1
  `) as ReviewRow[];
  return rows[0] ?? null;
};

const readPatch = (body: Record<string, unknown>, current: ReviewRow) => {
  const slugCheck =
    body.slug === undefined
      ? ({ ok: true, slug: current.slug } as const)
      : normalizeProposalSlug(body.slug);
  if (!slugCheck.ok) {
    return { error: slugCheck.error };
  }
  const title =
    typeof body.title === "string"
      ? sanitizeText(body.title).slice(0, MAX_REVIEW_TITLE)
      : current.title;
  if (!title) {
    return { error: "A title is required" };
  }
  let brandKitId = current.brand_kit_id;
  if (body.brandKitId === null || body.brandKitId === "") {
    brandKitId = null;
  } else if (typeof body.brandKitId === "string") {
    ({ brandKitId } = body as { brandKitId: string });
  }
  return {
    brandKitId,
    clientEmail:
      body.clientEmail === undefined
        ? (current.client_email ?? null)
        : cleanEmail(body.clientEmail),
    clientName:
      typeof body.clientName === "string"
        ? sanitizeText(body.clientName).slice(0, MAX_CLIENT_NAME)
        : current.client_name,
    doc:
      body.doc === undefined
        ? sanitizeReviewDoc(current.doc)
        : sanitizeReviewDoc(body.doc),
    slug: slugCheck.slug,
    status: isReviewStatus(body.status) ? body.status : current.status,
    title,
  };
};

const unlock = (
  row: ReviewRow,
  access: ReturnType<typeof accessOf>,
  body: Record<string, unknown>,
  res: VercelResponse
) => {
  if (!access) {
    return res.status(200).json({ pass: null });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!(password && passwordMatches(password, access))) {
    return res.status(401).json({ error: "That isn't the password" });
  }
  return res.status(200).json({ pass: passFor(row.id, access) });
};

type Viewer = ReturnType<typeof getBearerUser>;

/** GET the review, or POST its password for a pass. */
const read = (
  req: VercelRequest,
  res: VercelResponse,
  row: ReviewRow | null,
  user: Viewer
) => {
  if (!row || (row.status !== "published" && !user)) {
    return res.status(404).json({ error: "Review not found" });
  }
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
  const access = accessOf(row.doc);
  if (req.method === "POST") {
    return unlock(row, access, parseJsonBody(req.body), res);
  }
  if (access && !user && !passValid(passOf(req), row.id, access)) {
    return res.status(401).json({ locked: true, title: row.title });
  }
  return res.status(200).json(rowToReviewDto(row));
};

const save = async (
  sql: Sql,
  req: VercelRequest,
  res: VercelResponse,
  row: ReviewRow,
  userId: string
) => {
  const body = parseJsonBody(req.body);
  const patch = readPatch(body, row);
  if ("error" in patch) {
    return res.status(400).json({ error: patch.error });
  }
  const weak =
    typeof body.password === "string" && body.password !== ""
      ? passwordProblem(body.password)
      : null;
  if (weak) {
    return res.status(400).json({ error: weak });
  }
  // The doc arrives without the password or the client's comments, which
  // are never sent out; carry both over from what's stored.
  const doc = { ...patch.doc, ...keepPrivate(row.doc, body.password) };
  if (patch.slug !== row.slug) {
    const taken = await loadBySlug(sql, patch.slug);
    if (taken) {
      return res.status(409).json({ error: "That address is already taken" });
    }
  }
  await sql`
    UPDATE reviews SET
      slug = ${patch.slug},
      title = ${patch.title},
      client_name = ${patch.clientName},
      client_email = ${patch.clientEmail},
      brand_kit_id = ${patch.brandKitId},
      doc = ${JSON.stringify(doc)}::jsonb,
      status = ${patch.status},
      updated_at = now(),
      updated_by = ${userId}
    WHERE id = ${row.id}
  `;
  const fresh = await loadBySlug(sql, patch.slug);
  return res.status(200).json(fresh ? rowToReviewDto(fresh) : null);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  const raw =
    typeof req.query.slug === "string" ? req.query.slug : req.query.slug?.[0];
  const slug = raw?.trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ error: "Missing review address" });
  }
  const user = getBearerUser(req.headers.authorization);
  try {
    const sql = getSql();
    const row = await loadBySlug(sql, slug);
    if (req.method === "GET" || req.method === "POST") {
      return read(req, res, row, user);
    }
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!row) {
      return res.status(404).json({ error: "Review not found" });
    }
    if (req.method === "DELETE") {
      await sql`DELETE FROM reviews WHERE id = ${row.id}`;
      return res.status(204).end();
    }
    if (req.method !== "PATCH") {
      res.setHeader("Allow", "GET, POST, PATCH, DELETE");
      return res.status(405).json({ error: "Method not allowed" });
    }
    return await save(sql, req, res, row, user.userId);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not save the review" });
  }
}
