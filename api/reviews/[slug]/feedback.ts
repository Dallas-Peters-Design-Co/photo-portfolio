import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  cleanFeedback,
  feedbackOf,
  MAX_FEEDBACK,
} from "../../../config/reviewFeedback.js";
import { getBearerUser } from "../../_lib/auth.js";
import { handleCors } from "../../_lib/cors.js";
import { getSql } from "../../_lib/db.js";
import { parseJsonBody } from "../../_lib/parseBody.js";
import { accessOf, passOf, passValid } from "../../_lib/reviewAccess.js";

/**
 * A client's comments and markup on a review (config/reviewFeedback.ts).
 *
 *   POST    add one: anyone who can read the review (it's published, and
 *           they have its pass when it has a password), or the designer
 *   PATCH   { id, resolved }: the designer only
 *   DELETE  ?id=: the designer only
 *
 * Added in one statement that appends to the stored list, so two people
 * commenting at once both land, and the designer saving the review at the
 * same moment can't drop either (the save carries feedback over).
 */

type Sql = ReturnType<typeof getSql>;

interface Row {
  doc: unknown;
  id: string;
  status: string;
}

const load = async (sql: Sql, slug: string): Promise<Row | null> => {
  const rows = (await sql`
    SELECT id, doc, status FROM reviews WHERE slug = ${slug} LIMIT 1
  `) as Row[];
  return rows[0] ?? null;
};

const mayComment = (
  req: VercelRequest,
  row: Row,
  user: ReturnType<typeof getBearerUser>
): boolean => {
  if (user) {
    return true;
  }
  if (row.status !== "published") {
    return false;
  }
  const access = accessOf(row.doc);
  return !access || passValid(passOf(req), row.id, access);
};

const add = async (
  sql: Sql,
  req: VercelRequest,
  res: VercelResponse,
  row: Row,
  fromDesigner: boolean
) => {
  const body = parseJsonBody(req.body);
  const item = cleanFeedback({
    ...body,
    createdAt: new Date().toISOString(),
    id: undefined,
    resolved: false,
  });
  if (!item) {
    return res.status(400).json({ error: "Write a comment or draw something" });
  }
  if (feedbackOf(row.doc).length >= MAX_FEEDBACK) {
    return res
      .status(409)
      .json({ error: "This review has all the comments it can take" });
  }
  const stored =
    fromDesigner && !body.author ? { ...item, author: "Dallas" } : item;
  await sql`
    UPDATE reviews
    SET doc = jsonb_set(
      doc,
      '{feedback}',
      COALESCE(doc -> 'feedback', '[]'::jsonb) || ${JSON.stringify([stored])}::jsonb
    )
    WHERE id = ${row.id}
  `;
  return res.status(201).json(stored);
};

const change = async (
  sql: Sql,
  req: VercelRequest,
  res: VercelResponse,
  row: Row
) => {
  const body = parseJsonBody(req.body);
  const id =
    typeof req.query.id === "string" ? req.query.id : String(body.id ?? "");
  const list = feedbackOf(row.doc);
  if (!list.some((f) => f.id === id)) {
    return res.status(404).json({ error: "That comment isn't there" });
  }
  const next =
    req.method === "DELETE"
      ? list.filter((f) => f.id !== id)
      : list.map((f) =>
          f.id === id ? { ...f, resolved: body.resolved === true } : f
        );
  await sql`
    UPDATE reviews
    SET doc = jsonb_set(doc, '{feedback}', ${JSON.stringify(next)}::jsonb)
    WHERE id = ${row.id}
  `;
  return req.method === "DELETE"
    ? res.status(204).end()
    : res.status(200).json(next.find((f) => f.id === id));
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
    const row = await load(sql, slug);
    if (!row) {
      return res.status(404).json({ error: "Review not found" });
    }
    if (req.method === "POST") {
      return mayComment(req, row, user)
        ? await add(sql, req, res, row, Boolean(user))
        : res.status(401).json({ error: "Enter the review's password first" });
    }
    if (req.method === "PATCH" || req.method === "DELETE") {
      return user
        ? await change(sql, req, res, row)
        : res.status(401).json({ error: "Unauthorized" });
    }
    res.setHeader("Allow", "POST, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not save the comment" });
  }
}
