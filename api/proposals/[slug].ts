import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  MAX_CLIENT_NAME,
  MAX_PROPOSAL_TITLE,
  sanitizeProposalDoc,
} from "../../config/proposal.js";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";
import { sanitizeText } from "../_lib/httpUrl.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import {
  cleanEmail,
  isProposalStatus,
  normalizeProposalSlug,
  PROPOSAL_SELECT,
  type ProposalRow,
  rowToDto,
} from "../_lib/proposals.js";

/**
 * One proposal, by address.
 *
 * Public once published, like a CMS page, and a draft is readable at its real
 * URL only while signed in, so it can be previewed before it is sent. The
 * public response is marked noindex: a proposal is shared with one client by
 * link, and a search engine has no business listing it.
 */

type Sql = ReturnType<typeof getSql>;
type BearerUser = ReturnType<typeof getBearerUser>;

const resolveKitId = (
  requested: unknown,
  current: string | null
): string | null => {
  if (requested === null || requested === "") {
    return null;
  }
  return typeof requested === "string" ? requested : current;
};

const loadBySlug = async (sql: Sql, slug: string) => {
  const rows = (await sql`
    SELECT ${sql.unsafe(PROPOSAL_SELECT)}
    WHERE p.slug = ${slug}
    LIMIT 1
  `) as ProposalRow[];
  return rows[0] ?? null;
};

async function handleGet(
  sql: Sql,
  res: VercelResponse,
  slug: string,
  user: BearerUser
) {
  const row = await loadBySlug(sql, slug);
  if (!row || (row.status !== "published" && !user)) {
    return res.status(404).json({ error: "Proposal not found" });
  }
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (row.status === "published") {
    res.setHeader(
      "Cache-Control",
      "public, max-age=15, stale-while-revalidate=30"
    );
  }
  return res.status(200).json(rowToDto(row));
}

async function handlePatch(
  sql: Sql,
  req: VercelRequest,
  res: VercelResponse,
  slug: string,
  user: BearerUser
) {
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const current = await loadBySlug(sql, slug);
  if (!current) {
    return res.status(404).json({ error: "Proposal not found" });
  }

  const body = parseJsonBody(req.body);

  const title =
    typeof body.title === "string"
      ? sanitizeText(body.title).slice(0, MAX_PROPOSAL_TITLE)
      : current.title;
  if (!title) {
    return res.status(400).json({ error: "A proposal title is required." });
  }

  const slugCheck = normalizeProposalSlug(body.slug ?? slug);
  if (!slugCheck.ok) {
    return res.status(400).json({ error: slugCheck.error });
  }
  if (slugCheck.slug !== slug) {
    const clash =
      await sql`SELECT id FROM proposals WHERE slug = ${slugCheck.slug} LIMIT 1`;
    if (clash.length > 0) {
      return res
        .status(409)
        .json({ error: `A proposal already uses "${slugCheck.slug}".` });
    }
  }

  const clientName =
    typeof body.clientName === "string"
      ? sanitizeText(body.clientName).slice(0, MAX_CLIENT_NAME)
      : current.client_name;
  // Explicit null or empty clears the kit; absent leaves it alone.
  const brandKitId = resolveKitId(body.brandKitId, current.brand_kit_id);
  const clientEmail =
    body.clientEmail === undefined
      ? (current.client_email ?? null)
      : cleanEmail(body.clientEmail);
  // `acceptance: null` clears a recorded acceptance, so a proposal can be
  // re-sent or tested again. Nothing else about it can be edited by hand.
  const clearAcceptance = body.acceptance === null;
  const status = isProposalStatus(body.status) ? body.status : current.status;
  const doc =
    body.doc === undefined
      ? sanitizeProposalDoc(current.doc)
      : sanitizeProposalDoc(body.doc);

  const updated = (await sql`
    UPDATE proposals SET
      slug = ${slugCheck.slug},
      title = ${title},
      client_name = ${clientName},
      client_email = ${clientEmail},
      brand_kit_id = ${brandKitId},
      accepted_at = CASE WHEN ${clearAcceptance} THEN NULL ELSE accepted_at END,
      accepted_name = CASE WHEN ${clearAcceptance} THEN NULL ELSE accepted_name END,
      accepted_title = CASE WHEN ${clearAcceptance} THEN NULL ELSE accepted_title END,
      accepted_option = CASE WHEN ${clearAcceptance} THEN NULL ELSE accepted_option END,
      doc = ${JSON.stringify(doc)}::jsonb,
      status = ${status},
      updated_at = now(),
      updated_by = ${user.userId}
    WHERE slug = ${slug}
    RETURNING id
  `) as { id: string }[];
  if (updated.length === 0) {
    return res.status(404).json({ error: "Proposal not found" });
  }

  const row = await loadBySlug(sql, slugCheck.slug);
  if (!row) {
    return res.status(500).json({ error: "Could not save the proposal" });
  }
  return res.status(200).json(rowToDto(row));
}

async function handleDelete(
  sql: Sql,
  res: VercelResponse,
  slug: string,
  user: BearerUser
) {
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const deleted =
    await sql`DELETE FROM proposals WHERE slug = ${slug} RETURNING id`;
  if (deleted.length === 0) {
    return res.status(404).json({ error: "Proposal not found" });
  }
  return res.status(204).end();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }

  const raw =
    typeof req.query.slug === "string" ? req.query.slug : req.query.slug?.[0];
  const slug = raw?.trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ error: "Missing proposal address" });
  }

  try {
    const sql = getSql();
    const user = getBearerUser(req.headers.authorization);

    if (req.method === "GET") {
      return await handleGet(sql, res, slug, user);
    }
    if (req.method === "PATCH") {
      return await handlePatch(sql, req, res, slug, user);
    }
    if (req.method === "DELETE") {
      return await handleDelete(sql, res, slug, user);
    }

    res.setHeader("Allow", "GET, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("proposals")) {
      return res.status(503).json({
        error:
          "Database schema is out of date. Run pnpm db:migrate against this deployment.",
      });
    }
    return res.status(500).json({ error: "Request failed" });
  }
}
