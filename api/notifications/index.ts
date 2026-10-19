import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";
import { parseJsonBody } from "../_lib/parseBody.js";

/**
 * The owner's notifications: the activity log, newest first. Admin only.
 *
 * GET returns the latest entries and the unread count; with
 * `?proposal=<id>` it is that proposal's timeline instead, oldest first.
 * POST `{ read: "all" }` or `{ read: [ids] }` marks entries read.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 40;

interface ActivityRow {
  body: string;
  created_at: string | Date;
  id: string;
  kind: string;
  read_at: string | Date | null;
  subject_id: string | null;
  subject_type: string;
  title: string;
  url: string | null;
}

export interface ActivityDto {
  body: string;
  createdAt: string;
  id: string;
  kind: string;
  read: boolean;
  subjectId: string | null;
  title: string;
  url: string | null;
}

const toDto = (row: ActivityRow): ActivityDto => ({
  body: row.body,
  createdAt: new Date(row.created_at).toISOString(),
  id: row.id,
  kind: row.kind,
  read: row.read_at !== null,
  subjectId: row.subject_id,
  title: row.title,
  url: row.url,
});

type Sql = ReturnType<typeof getSql>;

const timeline = async (
  sql: Sql,
  res: VercelResponse,
  proposal: string
): Promise<VercelResponse> => {
  if (!UUID.test(proposal)) {
    return res.status(400).json({ error: "Bad proposal id" });
  }
  const rows = (await sql`
    SELECT id, kind, subject_type, subject_id, title, body, url, created_at, read_at
    FROM activity
    WHERE subject_type = 'proposal' AND subject_id = ${proposal}
    ORDER BY created_at
    LIMIT 200
  `) as ActivityRow[];
  return res.status(200).json({ items: rows.map(toDto) });
};

const latest = async (sql: Sql, res: VercelResponse) => {
  const rows = (await sql`
    SELECT id, kind, subject_type, subject_id, title, body, url, created_at, read_at
    FROM activity
    ORDER BY created_at DESC
    LIMIT ${PAGE}
  `) as ActivityRow[];
  const counts = (await sql`
    SELECT count(*)::int AS unread FROM activity WHERE read_at IS NULL
  `) as { unread: number }[];
  return res
    .status(200)
    .json({ items: rows.map(toDto), unread: counts[0]?.unread ?? 0 });
};

const markRead = async (sql: Sql, req: VercelRequest, res: VercelResponse) => {
  const { read } = parseJsonBody(req.body);
  if (read === "all") {
    await sql`UPDATE activity SET read_at = now() WHERE read_at IS NULL`;
    return res.status(204).end();
  }
  if (!Array.isArray(read)) {
    return res.status(400).json({ error: 'Send { read: "all" } or ids' });
  }
  const ids = read.filter(
    (id): id is string => typeof id === "string" && UUID.test(id)
  );
  if (ids.length > 0) {
    await sql`
      UPDATE activity SET read_at = now()
      WHERE id = ANY(${ids}::uuid[]) AND read_at IS NULL
    `;
  }
  return res.status(204).end();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  if (!getBearerUser(req.headers.authorization)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const sql = getSql();
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      const proposal =
        typeof req.query.proposal === "string" ? req.query.proposal : "";
      return proposal
        ? await timeline(sql, res, proposal)
        : await latest(sql, res);
    }
    if (req.method === "POST") {
      return await markRead(sql, req, res);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[notifications]", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("activity")) {
      return res.status(503).json({
        error:
          "Database schema is out of date. Run pnpm db:migrate against this deployment.",
      });
    }
    return res.status(500).json({ error: "Could not load notifications" });
  }
}
