import type { VercelRequest, VercelResponse } from "@vercel/node";
import { MAX_MERGE_OPTIONS } from "../../config/brandMerge.js";
import { cleanBrief } from "../../config/reviewBrief.js";
import { getBearerUser } from "../_lib/auth.js";
import { loadKit } from "../_lib/brandKitStore.js";
import { handleCors } from "../_lib/cors.js";
import { getSql } from "../_lib/db.js";
import { parsePublicHttpUrl } from "../_lib/httpUrl.js";
import { readMerge, startMerge } from "../_lib/mergeAgent.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import {
  DEFAULT_AGENT_PAGES,
  endCapture,
  isReviewAgentConfigured,
  MAX_AGENT_PAGES,
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
 * A brand merge writeup goes through the same agent (_lib/mergeAgent.ts):
 *
 *   POST { kind: "merge", brandA, brandB, options } → { session }
 *   GET  ?kind=merge&session=…&options=["…"]       → { state, phase | writeup | error }
 *
 * Here rather than in a file of its own: the project is at Vercel's
 * function limit.
 *
 * Admin only: the agent signs in with the stored test account and drives a
 * browser wherever it is pointed. The editor polls GET; when the agent is done
 * the pictures are copied into this site's store and returned as screens.
 */

export const config = { maxDuration: 120 };

const KIT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Option names as typed: trimmed, non-empty, at most MAX_MERGE_OPTIONS. */
const optionNames = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, MAX_MERGE_OPTIONS);

const startMergeWriteup = async (
  body: Record<string, unknown>,
  res: VercelResponse
) => {
  const options = optionNames(body.options);
  if (options.length === 0) {
    return res.status(400).json({ error: "Name at least one merge option" });
  }
  const ids = [body.brandA, body.brandB];
  if (
    !ids.every((id) => typeof id === "string" && KIT_ID.test(id)) ||
    ids[0] === ids[1]
  ) {
    return res.status(400).json({ error: "Pick two different brand kits" });
  }
  const sql = getSql();
  const [a, b] = await Promise.all(ids.map((id) => loadKit(sql, id as string)));
  if (!(a && b)) {
    return res.status(404).json({ error: "One of those brand kits is gone" });
  }
  const session = await startMerge(
    { doc: a.resolvedDoc, name: a.name },
    { doc: b.resolvedDoc, name: b.name },
    options
  );
  return res.status(202).json({ session });
};

const mergeStatus = async (
  req: VercelRequest,
  res: VercelResponse,
  session: string
) => {
  let asked: unknown = [];
  try {
    asked = JSON.parse(
      typeof req.query.options === "string" ? req.query.options : "[]"
    );
  } catch {
    // No names: the agent's own are kept.
  }
  const merge = await readMerge(session, optionNames(asked));
  if (merge.state !== "running") {
    await endCapture(session);
  }
  return res.status(200).json(merge);
};

const start = async (req: VercelRequest, res: VercelResponse) => {
  const body = parseJsonBody(req.body);
  if (body.kind === "merge") {
    return startMergeWriteup(body, res);
  }
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
    ? Math.min(MAX_AGENT_PAGES, Math.max(1, body.pages as number))
    : DEFAULT_AGENT_PAGES;
  const session = await startCapture({
    brief: cleanBrief(body.brief),
    loginUrl,
    pages,
    url,
  });
  return res.status(202).json({ session });
};

const status = async (req: VercelRequest, res: VercelResponse) => {
  const session =
    typeof req.query.session === "string" ? req.query.session : "";
  if (!SESSION_ID.test(session)) {
    return res.status(400).json({ error: "Unknown capture" });
  }
  if (req.query.kind === "merge") {
    return mergeStatus(req, res, session);
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
  return res
    .status(200)
    .json({ checks: capture.checks, note, screens, state: "done" });
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
