import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../../_lib/auth.js";
import { handleCors } from "../../_lib/cors.js";
import { getSql } from "../../_lib/db.js";
import { ADMIN_TOKEN_KEY, allowedPageOrigin } from "../../_lib/pageOrigin.js";
import { parseJsonBody } from "../../_lib/parseBody.js";
import { renderPagePdf } from "../../_lib/screenshot.js";

/**
 * The proposal as a PDF: the public page itself, printed by a real browser.
 *
 * The page carries its own print stylesheet, so this is the one rendering of
 * the proposal rather than a second one kept in step by hand. A published
 * proposal can be printed by anyone with the link, like the page; a draft
 * only by an admin, whose token is handed to the headless browser so the
 * page resolves there too.
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
    return res.status(400).json({ error: "Missing proposal address" });
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
      SELECT status FROM proposals WHERE slug = ${slug} LIMIT 1
    `) as { status: string }[];
    const [row] = rows;
    if (!row || (row.status !== "published" && !admin)) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    const token = admin && auth ? auth.slice("Bearer ".length) : null;
    const pdf = await renderPagePdf({
      localStorage: token ? { [ADMIN_TOKEN_KEY]: token } : undefined,
      url: `${origin}/proposal/${encodeURIComponent(slug)}`,
      waitFor: ".proposal-page__sheet",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="proposal-${slug}.pdf"`
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pdf);
  } catch (e) {
    console.error("[proposal pdf]", e);
    return res
      .status(502)
      .json({ error: "Could not render the PDF. Try again in a moment." });
  }
}
