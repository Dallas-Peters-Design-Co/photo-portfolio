import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";

/**
 * Who this session belongs to, and what they are: the admin, or a member
 * who reaches only the boards shared with them (boardAccess.ts).
 *
 * The admin shell only ever knew a token *existed* in local storage, so any
 * stale or forged value skipped the login screen and left a page that 401'd
 * on every call. This is the check the shell was missing: a valid token is
 * confirmed here before the admin is shown, and anything else is thrown out.
 *
 * `?people=1`, for the admin: everyone a board is shared with, and which.
 */

interface PersonRow {
  board_id: string | null;
  board_role: string | null;
  board_title: string | null;
  email: string;
  id: string;
}

const people = async () => {
  const rows = (await getSql()`
    SELECT u.id, u.email, b.id AS board_id, b.title AS board_title,
           m.role AS board_role
    FROM users u
    LEFT JOIN board_members m ON m.user_id = u.id
    LEFT JOIN boards b ON b.id = m.board_id
    WHERE u.role = 'member'
    ORDER BY u.email, b.title
  `) as PersonRow[];
  const byId = new Map<
    string,
    {
      boards: { id: string; role: string; title: string }[];
      email: string;
      id: string;
    }
  >();
  for (const row of rows) {
    const person = byId.get(row.id) ?? {
      boards: [],
      email: row.email,
      id: row.id,
    };
    if (row.board_id && row.board_role) {
      person.boards.push({
        id: row.board_id,
        role: row.board_role,
        title: row.board_title ?? "Untitled board",
      });
    }
    byId.set(row.id, person);
  }
  return [...byId.values()];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = getSessionUser(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.query.people === "1") {
    return user.role === "admin"
      ? res.status(200).json({ people: await people() })
      : res.status(401).json({ error: "Unauthorized" });
  }
  return res
    .status(200)
    .json({ user: { email: user.email, id: user.userId, role: user.role } });
}
