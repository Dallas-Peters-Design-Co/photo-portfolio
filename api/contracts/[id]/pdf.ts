import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../../_lib/auth.js";
import { isUuid } from "../../_lib/contracts.js";
import { handleCors } from "../../_lib/cors.js";
import { getSql } from "../../_lib/db.js";
import { ADMIN_TOKEN_KEY, allowedPageOrigin } from "../../_lib/pageOrigin.js";
import { parseJsonBody } from "../../_lib/parseBody.js";
import { renderPagePdf } from "../../_lib/screenshot.js";

/**
 * The agreement as a PDF: its page, printed by a real browser, as the
 * proposal and review PDFs are. Anyone with the link can print a sent or
 * signed agreement; a draft only an admin.
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
    typeof req.query.id === "string" ? req.query.id : req.query.id?.[0];
  const id = (raw ?? "").trim().toLowerCase();
  if (!isUuid(id)) {
    return res.status(400).json({ error: "Missing agreement" });
  }
  const origin = allowedPageOrigin(parseJsonBody(req.body).origin);
  if (!origin) {
    return res.status(400).json({ error: "Unknown page origin" });
  }
  const auth = req.headers.authorization;
  const admin = getBearerUser(auth);
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT status FROM contracts WHERE id = ${id} LIMIT 1
    `) as { status: string }[];
    const [row] = rows;
    if (!row || (row.status === "draft" && !admin)) {
      return res.status(404).json({ error: "Agreement not found" });
    }
    const token = admin && auth ? auth.slice("Bearer ".length) : null;
    const pdf = await renderPagePdf({
      localStorage: token ? { [ADMIN_TOKEN_KEY]: token } : undefined,
      url: `${origin}/contract/${id}`,
      waitFor: ".contract-page__sheet",
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="agreement-${id.slice(0, 8)}.pdf"`
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pdf);
  } catch (e) {
    console.error("[contract pdf]", e);
    return res
      .status(502)
      .json({ error: "Could not render the PDF. Try again in a moment." });
  }
}
