import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../_lib/auth.js";
import { handleCors } from "../_lib/cors.js";
import { allowedPageOrigin } from "../_lib/pageOrigin.js";
import { parseJsonBody } from "../_lib/parseBody.js";
import { renderSheetPdf, sheetSpecFrom } from "../_lib/printSheet.js";

/**
 * A frame as a print-ready vector PDF: the frame editor sends the sheet as
 * HTML and its size, and gets back the PDF a print shop takes, with the trim
 * and bleed marked in it. See printSheet.ts.
 *
 * Admin only: it drives a browser over HTML the caller wrote.
 */

export const config = { maxDuration: 60 };

/** Vercel refuses request bodies past 4.5 MB; say so plainly before then. */
const MAX_HTML = 4_000_000;

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
  const origin = allowedPageOrigin(body.origin);
  if (!origin) {
    return res.status(400).json({ error: "Unknown page origin" });
  }
  const spec = sheetSpecFrom(body);
  if (!spec) {
    return res.status(400).json({ error: "That sheet size isn't printable" });
  }
  const html = typeof body.html === "string" ? body.html : "";
  if (!html || html.length > MAX_HTML) {
    return res
      .status(400)
      .json({ error: html ? "The design is too large to send" : "No design" });
  }
  try {
    const pdf = await renderSheetPdf(html, origin, spec);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    console.error("[print pdf]", e);
    return res
      .status(502)
      .json({ error: "Could not print the PDF. Try again in a moment." });
  }
}
