import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  DEFAULT_PROPOSAL_DOC,
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
  rowToSummary,
} from "../_lib/proposals.js";

/**
 * The proposals: what exists, and making a new one.
 *
 * Admin-only in both directions. A proposal is reachable by its own address
 * once published, but the list of them is a list of clients and prices, which
 * is nobody else's business.
 *
 * A new proposal starts from DEFAULT_PROPOSAL_DOC rather than empty: the
 * sections about how the work runs are the same every time, and the point of
 * writing them down once is not typing them again.
 */

type Sql = ReturnType<typeof getSql>;
type User = ReturnType<typeof getBearerUser>;

async function handleGet(sql: Sql, user: User, res: VercelResponse) {
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const rows = (await sql`
    SELECT ${sql.unsafe(PROPOSAL_SELECT)}
    ORDER BY p.updated_at DESC
  `) as ProposalRow[];
  return res.status(200).json(rows.map(rowToSummary));
}

async function handlePost(
  sql: Sql,
  user: User,
  req: VercelRequest,
  res: VercelResponse
) {
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = parseJsonBody(req.body);
  const title =
    typeof body.title === "string"
      ? sanitizeText(body.title).slice(0, MAX_PROPOSAL_TITLE)
      : "";
  if (!title) {
    return res.status(400).json({ error: "A proposal title is required." });
  }

  const slugCheck = normalizeProposalSlug(body.slug);
  if (!slugCheck.ok) {
    return res.status(400).json({ error: slugCheck.error });
  }

  const clientName =
    typeof body.clientName === "string"
      ? sanitizeText(body.clientName).slice(0, MAX_CLIENT_NAME)
      : "";
  const brandKitId =
    typeof body.brandKitId === "string" && body.brandKitId
      ? body.brandKitId
      : null;
  const clientEmail = cleanEmail(body.clientEmail);
  const status = isProposalStatus(body.status) ? body.status : "draft";
  const doc =
    body.doc === undefined
      ? DEFAULT_PROPOSAL_DOC
      : sanitizeProposalDoc(body.doc);

  const existing =
    await sql`SELECT id FROM proposals WHERE slug = ${slugCheck.slug} LIMIT 1`;
  if (existing.length > 0) {
    return res
      .status(409)
      .json({ error: `A proposal already uses "${slugCheck.slug}".` });
  }

  const inserted = (await sql`
    INSERT INTO proposals (slug, title, client_name, client_email, brand_kit_id, doc, status, updated_by)
    VALUES (
      ${slugCheck.slug}, ${title}, ${clientName}, ${clientEmail}, ${brandKitId},
      ${JSON.stringify(doc)}::jsonb, ${status}, ${user.userId}
    )
    RETURNING id
  `) as { id: string }[];
  const [created] = inserted;
  if (!created) {
    return res.status(500).json({ error: "Could not create the proposal" });
  }

  // Read back through the join so the response carries the brand the same way
  // every later read will.
  const rows = (await sql`
    SELECT ${sql.unsafe(PROPOSAL_SELECT)}
    WHERE p.id = ${created.id}
  `) as ProposalRow[];
  const [row] = rows;
  if (!row) {
    return res.status(500).json({ error: "Could not create the proposal" });
  }
  return res.status(201).json(rowToDto(row));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }

  try {
    const sql = getSql();
    const user = getBearerUser(req.headers.authorization);

    if (req.method === "GET") {
      return await handleGet(sql, user, res);
    }
    if (req.method === "POST") {
      return await handlePost(sql, user, req, res);
    }

    res.setHeader("Allow", "GET, POST");
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
