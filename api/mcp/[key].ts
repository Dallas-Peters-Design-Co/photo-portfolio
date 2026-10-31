import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../_lib/db.js";
import { handleRpc, keyMatches, type RpcResponse } from "../_lib/mcp.js";
import { SITE_TOOLS } from "../_lib/mcpTools.js";

/**
 * The site as a Claude connector (Model Context Protocol, Streamable HTTP,
 * stateless).
 *
 *   POST /api/mcp/<MCP_ACCESS_TOKEN>                    for Claude's "custom
 *                                                       connector", which
 *                                                       takes a URL only
 *   POST /api/mcp/connect  Authorization: Bearer <token>  for clients that
 *                                                       can send a header
 *
 * The key in the URL is a password: anyone with the full address can read
 * proposals and invoices. Rotating MCP_ACCESS_TOKEN in Vercel and redeploying
 * revokes every copy at once. Without the env var the endpoint is off.
 */

const presentedKey = (req: VercelRequest): string | undefined => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  const { key } = req.query;
  return typeof key === "string" && key !== "connect" ? key : undefined;
};

const parse = (body: unknown): unknown => {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body ?? null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!keyMatches(presentedKey(req), process.env.MCP_ACCESS_TOKEN)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method === "GET" || req.method === "DELETE") {
    // No server-initiated stream and no sessions to end.
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parse(req.body);
  const batch = Array.isArray(body);
  const messages = (batch ? body : [body]).filter(
    (m): m is Record<string, unknown> => !!m && typeof m === "object"
  );
  if (messages.length === 0) {
    return res.status(400).json({
      error: { code: -32_700, message: "Parse error" },
      id: null,
      jsonrpc: "2.0",
    });
  }

  const ctx = { sql: getSql() };
  const responses: RpcResponse[] = [];
  for (const msg of messages) {
    // biome-ignore lint/performance/noAwaitInLoops: a batch is answered in the order it was sent
    const out = await handleRpc(msg, SITE_TOOLS, ctx);
    if (out) {
      responses.push(out);
    }
  }
  if (responses.length === 0) {
    // Only notifications: acknowledged, nothing to say.
    return res.status(202).end();
  }
  return res.status(200).json(batch ? responses : responses[0]);
}
