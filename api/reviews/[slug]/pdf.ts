import type { VercelRequest, VercelResponse } from "@vercel/node";
import { reviewPassKey } from "../../../config/reviewFeedback.js";
import { getBearerUser } from "../../_lib/auth.js";
import { handleCors } from "../../_lib/cors.js";
import { getSql } from "../../_lib/db.js";
import { ADMIN_TOKEN_KEY, allowedPageOrigin } from "../../_lib/pageOrigin.js";
import { parseJsonBody } from "../../_lib/parseBody.js";
import { accessOf, passOf, passValid } from "../../_lib/reviewAccess.js";
import { renderPagePdf } from "../../_lib/screenshot.js";

/**
 * The review as a PDF: the client's page itself, printed by a real browser,
 * screenshots, markup and numbered notes included.
 *
 * Same arrangement as the proposal PDF: one rendering, the page's own print
 * stylesheet. A published review prints for anyone with the link; a draft
 * only for an admin, whose token is handed to the headless browser. One with
 * a password prints for someone holding its pass, which goes to the headless
 * browser the same way.
 *
 * The browser needs the page's address; see allowedPageOrigin for which
 * origins it may be.
 */

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const raw =
    typeof req.query.slug === "string" ? req.query.slug : req.query.slug?.[0];
  const slug = raw?.trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ error: "Missing review address" });
  }
  const body = parseJsonBody(req.body);
  const origin = allowedPageOrigin(body.origin);
  if (!origin) {
    return res.status(400).json({ error: "Unknown page origin" });
  }
  const auth = req.headers.authorization;
  const admin = getBearerUser(auth);

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, status, doc FROM reviews WHERE slug = ${slug} LIMIT 1
    `) as { doc?: unknown; id?: string; status: string }[];
    const [row] = rows;
    if (!row || (row.status !== "published" && !admin)) {
      return res.status(404).json({ error: "Review not found" });
    }
    const access = accessOf(row.doc);
    const pass =
      passOf(req) ?? (typeof body.pass === "string" ? body.pass : null);
    if (access && !admin && !passValid(pass, row.id ?? "", access)) {
      return res
        .status(401)
        .json({ error: "Enter the review's password first" });
    }
    const token = admin && auth ? auth.slice("Bearer ".length) : null;
    const storage: Record<string, string> = {};
    if (token) {
      storage[ADMIN_TOKEN_KEY] = token;
    } else if (access && pass) {
      storage[reviewPassKey(slug)] = pass;
    }
    const pdf = await renderPagePdf({
      localStorage: Object.keys(storage).length > 0 ? storage : undefined,
      url: `${origin}/review/${encodeURIComponent(slug)}`,
      waitFor: ".review-page__sheet",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="review-${slug}.pdf"`
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pdf);
  } catch (e) {
    console.error("[review pdf]", e);
    return res
      .status(502)
      .json({ error: "Could not render the PDF. Try again in a moment." });
  }
}
