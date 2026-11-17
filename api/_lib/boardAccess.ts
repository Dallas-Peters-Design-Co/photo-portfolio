import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { getSql } from "./db.js";
import { parseJsonBody } from "./parseBody.js";

/**
 * Boards shared with people other than the admin (db/patches/053).
 *
 * A member is a users row with role 'member' and no password: they sign in
 * with Google through Neon Auth (neonAuth.ts), and are found by address. A
 * viewer opens the board and comments; an editor also saves changes to it.
 * Publishing, deleting and every other part of the site stay the admin's.
 */

type Sql = ReturnType<typeof getSql>;

export type BoardRole = "editor" | "viewer";

export const isBoardRole = (value: unknown): value is BoardRole =>
  value === "viewer" || value === "editor";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A member's level on a board, found by its id or its slug; null for none. */
export const boardRoleFor = async (
  sql: Sql,
  userId: string,
  idOrSlug: string
): Promise<BoardRole | null> => {
  const rows = (await sql`
    SELECT m.role
    FROM board_members m
    JOIN boards b ON b.id = m.board_id
    WHERE m.user_id = ${userId}
      AND (b.id::text = ${idOrSlug} OR b.slug = ${idOrSlug})
    LIMIT 1
  `) as { role: string }[];
  const role = rows[0]?.role;
  return isBoardRole(role) ? role : null;
};

export interface BoardMemberDto {
  email: string;
  role: BoardRole;
  userId: string;
}

const listMembers = async (
  sql: Sql,
  boardId: string
): Promise<BoardMemberDto[]> =>
  (
    (await sql`
      SELECT u.id AS user_id, u.email, m.role
      FROM board_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.board_id = ${boardId}
      ORDER BY u.email
    `) as { email: string; role: string; user_id: string }[]
  )
    .filter((r) => isBoardRole(r.role))
    .map((r) => ({
      email: r.email,
      role: r.role as BoardRole,
      userId: r.user_id,
    }));

/** Shares the board with an address, making the member if they are new. */
const addMember = async (
  sql: Sql,
  boardId: string,
  body: Record<string, unknown>,
  res: VercelResponse
) => {
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) {
    return res.status(400).json({ error: "Enter an email address" });
  }
  if (!isBoardRole(body.role)) {
    return res.status(400).json({ error: "Pick Viewer or Editor" });
  }
  // A new address becomes a member with no password; an existing one keeps
  // the role it has, so sharing never demotes or promotes anyone.
  const [user] = (await sql`
    INSERT INTO users (email, role)
    VALUES (${email}, 'member')
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id, role
  `) as { id: string; role: string }[];
  if (!user) {
    return res.status(500).json({ error: "Could not add that person" });
  }
  if (user.role === "admin") {
    return res
      .status(400)
      .json({ error: "That's an admin: they can open every board already" });
  }
  await sql`
    INSERT INTO board_members (board_id, user_id, role)
    VALUES (${boardId}, ${user.id}, ${body.role})
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role
  `;
  return res.status(200).json({ members: await listMembers(sql, boardId) });
};

/**
 * The board's people, for the admin: GET lists them, POST {email, role}
 * shares or changes a level, DELETE ?userId= takes the board away.
 */
export const handleBoardMembers = async (
  sql: Sql,
  boardId: string,
  req: VercelRequest,
  res: VercelResponse
) => {
  if (!UUID.test(boardId)) {
    return res.status(400).json({ error: "A board id is required" });
  }
  if (req.method === "GET") {
    return res.status(200).json({ members: await listMembers(sql, boardId) });
  }
  if (req.method === "POST") {
    return await addMember(sql, boardId, parseJsonBody(req.body), res);
  }
  if (req.method === "DELETE") {
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    if (!UUID.test(userId)) {
      return res.status(400).json({ error: "Who should lose access?" });
    }
    await sql`
      DELETE FROM board_members
      WHERE board_id = ${boardId} AND user_id = ${userId}
    `;
    return res.status(200).json({ members: await listMembers(sql, boardId) });
  }
  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
};
