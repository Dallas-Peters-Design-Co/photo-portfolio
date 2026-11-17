import type { VercelRequest, VercelResponse } from "@vercel/node";
import { MAX_REVIEW_TITLE, sanitizeReviewDoc } from "../../config/review.js";
import { cleanBrief } from "../../config/reviewBrief.js";
import { isAuditTopicKey } from "../../config/reviewTopics.js";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { sanitizeText } from "../_lib/httpUrl.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import { withRequestIdentity } from "../_lib/requestIdentity.js";
import { AUDIT_LIFETIME_MS, signScreens } from "../_lib/reviewImages.js";
import {
  isClaudeAuditConfigured,
  runUxAudit,
  sourcesFromScreens,
} from "../_lib/uxAudit/audit.js";
import { runTopicPass } from "../_lib/uxAudit/topicPasses.js";

/**
 * Runs a UX audit across a review's screens and returns the structured
 * findings. Admin only: each run tiles the screenshots and calls Claude.
 * The editor folds the returned audit into the draft and saves as usual.
 */

export const config = { maxDuration: 300 };

const serve = async (req: VercelRequest, res: VercelResponse) => {
  if (handleCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!getBearerUser(req.headers.authorization)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = parseJsonBody(req.body);
  // Links from the editor may have expired; private pictures are signed
  // fresh for the time the audit takes to read them.
  const screens = await signScreens(
    sanitizeReviewDoc({ screens: body.screens }).screens,
    AUDIT_LIFETIME_MS
  );
  if (sourcesFromScreens(screens).length === 0) {
    return res.status(400).json({
      error: "Capture or upload at least one screen before running an audit.",
    });
  }
  const title =
    typeof body.title === "string"
      ? sanitizeText(body.title).slice(0, MAX_REVIEW_TITLE)
      : "";

  try {
    if (!(await isClaudeAuditConfigured())) {
      return res.status(503).json({
        error: "Claude is not configured on this deployment.",
      });
    }
    // One topic of the deep audit, as its own request beside the main one
    // (topicPasses.ts), so each stays inside a function's time.
    if (isAuditTopicKey(body.topic)) {
      const topic = await runTopicPass({
        brief: cleanBrief(body.brief),
        screens,
        title,
        topic: body.topic,
      });
      return res.status(200).json({ topic });
    }
    const audit = await runUxAudit({
      brief: cleanBrief(body.brief),
      screens,
      title,
    });
    return res.status(200).json({ audit });
  } catch (e) {
    console.error("[review audit]", e);
    const message =
      e instanceof Error ? e.message : "Could not run the UX audit";
    return res.status(502).json({ error: message });
  }
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  return withRequestIdentity(req.headers, () => serve(req, res));
}
