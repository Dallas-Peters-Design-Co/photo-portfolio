import { del, put } from "@vercel/blob";
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
 *
 * A sheet or PDF past Vercel's 4.5 MB limit goes through Blob storage: the
 * HTML arrives as the address of an uploaded copy, and the PDF goes back as
 * the address of one (src/boards/creative/printTransport.ts). Both are
 * deleted once read: the HTML here, the PDF when the browser says it's done.
 */

export const config = { maxDuration: 60 };

/** Vercel refuses request bodies past 4.5 MB; say so plainly before then. */
const MAX_HTML = 4_000_000;
/** A sheet uploaded to Blob first can be far bigger. */
const MAX_UPLOADED_HTML = 80_000_000;
/** A PDF past this goes back through Blob rather than in the response. */
const MAX_INLINE_PDF = 4_000_000;

/** A print job's file in this project's Blob storage, and nowhere else. */
const isPrintJob = (url: unknown): url is string => {
  try {
    const u = new URL(String(url));
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".public.blob.vercel-storage.com") &&
      u.pathname.startsWith("/print-jobs/")
    );
  } catch {
    return false;
  }
};

/** The sheet's HTML: sent inline, or read (then deleted) from Blob. */
const sheetHtml = async (body: Record<string, unknown>): Promise<string> => {
  if (typeof body.html === "string") {
    return body.html.length > MAX_HTML ? "" : body.html;
  }
  if (!isPrintJob(body.htmlUrl)) {
    return "";
  }
  try {
    const got = await fetch(body.htmlUrl);
    const html = got.ok ? await got.text() : "";
    return html.length > MAX_UPLOADED_HTML ? "" : html;
  } finally {
    await del(body.htmlUrl).catch(() => undefined);
  }
};

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
  if (body.done !== undefined) {
    // The browser has its PDF: the copy left in Blob goes.
    if (isPrintJob(body.done)) {
      await del(body.done).catch(() => undefined);
    }
    return res.status(204).end();
  }
  const origin = allowedPageOrigin(body.origin);
  if (!origin) {
    return res.status(400).json({ error: "Unknown page origin" });
  }
  const spec = sheetSpecFrom(body);
  if (!spec) {
    return res.status(400).json({ error: "That sheet size isn't printable" });
  }
  const html = await sheetHtml(body);
  if (!html) {
    return res
      .status(400)
      .json({ error: "The design didn't arrive, or is too large to print" });
  }
  try {
    const pdf = await renderSheetPdf(html, origin, spec);
    if (pdf.byteLength > MAX_INLINE_PDF) {
      const stored = await put("print-jobs/print.pdf", Buffer.from(pdf), {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/pdf",
      });
      return res.status(200).json({ url: stored.url });
    }
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
