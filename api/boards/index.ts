import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser, getSessionUser } from "../_lib/auth.js";
import { rowToBoardDto } from "../_lib/boardDto.js";
import type { BoardRow } from "../_lib/boards.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";
import { sanitizeText } from "../_lib/httpUrl.js";
import { parseJsonBody } from "../_lib/parseBody.js";

type Sql = ReturnType<typeof getSql>;
type User = ReturnType<typeof getBearerUser>;

/** A member's boards: only those shared with them, each with their level. */
async function memberBoards(sql: Sql, userId: string, res: VercelResponse) {
  const rows = (await sql`
    SELECT b.id, b.title, b.cover_url, b.is_public, b.slug,
           b.created_at, b.updated_at, m.role AS access,
           COUNT(i.id) AS item_count
    FROM board_members m
    JOIN boards b ON b.id = m.board_id
    LEFT JOIN board_items i ON i.board_id = b.id
    WHERE m.user_id = ${userId}
    GROUP BY b.id, m.role
    ORDER BY b.updated_at DESC
  `) as (BoardRow & { access: string })[];
  return res
    .status(200)
    .json(rows.map((row) => ({ ...rowToBoardDto(row), access: row.access })));
}

async function handleGet(
  sql: Sql,
  user: User,
  req: VercelRequest,
  res: VercelResponse
) {
  // Boards are a planning surface, so the list is the admin's. Published boards
  // are read individually by slug, not enumerated — a public index would leak
  // every board title the moment one board was shared. A member gets only the
  // boards shared with them.
  if (!user) {
    const session = getSessionUser(req.headers.authorization);
    return session
      ? await memberBoards(sql, session.userId, res)
      : res.status(401).json({ error: "Unauthorized" });
  }

  const rows = (await sql`
    SELECT b.id, b.title, b.cover_url, b.is_public, b.slug,
           b.created_at, b.updated_at,
           COUNT(i.id) AS item_count
    FROM boards b
    LEFT JOIN board_items i ON i.board_id = b.id
    GROUP BY b.id
    ORDER BY b.updated_at DESC
  `) as BoardRow[];

  return res.status(200).json(rows.map((row) => rowToBoardDto(row)));
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
    (typeof body.title === "string"
      ? sanitizeText(body.title).slice(0, 120)
      : "") || "Untitled board";

  const rows = (await sql`
    INSERT INTO boards (title, created_by)
    VALUES (${title}, ${user.userId})
    RETURNING id, title, cover_url, is_public, slug, created_at, updated_at
  `) as BoardRow[];

  return res.status(201).json(rowToBoardDto(rows[0]));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }

  const sql = getSql();
  const user = getBearerUser(req.headers.authorization);

  try {
    if (req.method === "GET") {
      return await handleGet(sql, user, req, res);
    }
    if (req.method === "POST") {
      return await handlePost(sql, user, req, res);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Could not load boards" });
  }
}
