import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { parsePublicHttpUrl } from "../_lib/httpUrl.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import {
  endCapture,
  isReviewAgentConfigured,
  readCapture,
  startCapture,
  storeScreens,
} from "../_lib/reviewAgent.js";
import { signScreens } from "../_lib/reviewImages.js";

/**
 * Screens captured by the eve audit agent, for apps behind a login.
 *
 *   POST { slug, url, loginUrl?, pages? } → { session }
 *   GET  ?session=…&slug=…               → { state: "running", phase }
 *                                         | { state: "done", screens, note }
 *                                         | { state: "failed", error }
 *
 * Admin only: the agent signs in with the stored test account and drives a
 * browser wherever it is pointed. The editor polls GET; when the agent is done
 * the pictures are copied into this site's store and returned as screens.
 */

export const config = { maxDuration: 120 };

const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_PAGES = 6;

const start = async (req: VercelRequest, res: VercelResponse) => {
  const body = parseJsonBody(req.body);
  const url =
    typeof body.url === "string" ? parsePublicHttpUrl(body.url.trim()) : null;
  if (!url) {
    return res.status(400).json({ error: "Enter a full https:// address" });
  }
  const rawLogin =
    typeof body.loginUrl === "string" ? body.loginUrl.trim() : "";
  const loginUrl = rawLogin ? parsePublicHttpUrl(rawLogin) : null;
  if (rawLogin && !loginUrl) {
    return res
      .status(400)
      .json({ error: "The login page must be a full https:// address" });
  }
  const pages = Number.isInteger(body.pages)
    ? Math.min(MAX_PAGES, Math.max(1, body.pages as number))
    : 4;
  const session = await startCapture({ loginUrl, pages, url });
  return res.status(202).json({ session });
};

const status = async (req: VercelRequest, res: VercelResponse) => {
  const session =
    typeof req.query.session === "string" ? req.query.session : "";
  if (!SESSION_ID.test(session)) {
    return res.status(400).json({ error: "Unknown capture" });
  }
  const capture = await readCapture(session);
  if (capture.state === "running") {
    return res.status(200).json(capture);
  }
  await endCapture(session);
  if (capture.state === "failed") {
    return res.status(200).json(capture);
  }
  const screens = await signScreens(await storeScreens(capture.screens));
  const note =
    screens.length === capture.screens.length
      ? capture.note
      : `${capture.note} ${capture.screens.length - screens.length} of ${capture.screens.length} pictures could not be found in the review store.`.trim();
  return res.status(200).json({ note, screens, state: "done" });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  if (!getBearerUser(req.headers.authorization)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isReviewAgentConfigured()) {
    return res.status(503).json({
      error:
        "The audit agent is not configured. Set EVE_AGENT_URL and EVE_API_TOKEN.",
    });
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "POST") {
      return await start(req, res);
    }
    if (req.method === "GET") {
      return await status(req, res);
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[review explore]", e);
    return res.status(502).json({
      error: e instanceof Error ? e.message : "The audit agent failed",
    });
  }
}
