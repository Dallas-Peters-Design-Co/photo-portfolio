import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CAPTURE_WIDTHS } from "../../config/review.js";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { parsePublicHttpUrl } from "../_lib/httpUrl.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import { captureScreenshot } from "../_lib/screenshot.js";

/**
 * Screenshots a public URL for a review screen. Admin only: this drives a
 * browser at whatever address it is given, which is not something to leave
 * open. Returns the stored image and its size; the editor puts it on the
 * screen and saves the review as usual.
 */

export const config = { maxDuration: 60 };

const TIMEOUT = /timeout/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  const url =
    typeof body.url === "string" ? parsePublicHttpUrl(body.url.trim()) : null;
  if (!url) {
    return res.status(400).json({ error: "Enter a full https:// address" });
  }
  const viewport = body.viewport === "mobile" ? "mobile" : "desktop";
  const slug =
    typeof body.slug === "string" ? body.slug.replace(/[^a-z0-9-]/g, "") : "";
  try {
    const image = await captureScreenshot({
      prefix: `reviews/${slug || "untitled"}`,
      url,
      width: CAPTURE_WIDTHS[viewport],
    });
    return res.status(200).json({ image, viewport });
  } catch (e) {
    console.error("[review capture]", e);
    const msg = e instanceof Error ? e.message : "";
    if (TIMEOUT.test(msg)) {
      return res.status(504).json({
        error:
          "That page took too long to load. Try again, or upload a screenshot.",
      });
    }
    return res.status(502).json({
      error: "Could not capture that page. Upload a screenshot instead.",
    });
  }
}
