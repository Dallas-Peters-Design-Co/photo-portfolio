import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBearerUser } from "../../_lib/auth.js";
import { handleCors } from "../../_lib/cors.js";
import { getSql } from "../../_lib/db.js";
import { EmailNotConfiguredError, sendEmail } from "../../_lib/email.js";
import { sanitizeText } from "../../_lib/httpUrl.js";
import { parseJsonBody } from "../../_lib/parseBody.js";
import { reviewLinkEmail } from "../../_lib/reviewEmail.js";
import {
  REVIEW_SELECT,
  type ReviewRow,
  rowToReviewDto,
} from "../../_lib/reviews.js";
import { emailBrand, getSite } from "../../_lib/site.js";

/**
 * Sends the review link to the client.
 *
 * Admin only. The address is the one on the review, not one typed into
 * this request, so what was sent where is always what the record says. The
 * review has to be published, because the link in the mail is the public
 * page and a draft would 404 for the client. The send is recorded only after
 * Resend accepts it; a failed send leaves the record as it was.
 */

const MAX_NOTE = 2000;

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

  const raw =
    typeof req.query.slug === "string" ? req.query.slug : req.query.slug?.[0];
  const slug = raw?.trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ error: "Missing review address" });
  }
  const body = parseJsonBody(req.body);
  const note =
    typeof body.note === "string"
      ? sanitizeText(body.note).slice(0, MAX_NOTE)
      : "";

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT ${sql.unsafe(REVIEW_SELECT)}
      WHERE r.slug = ${slug}
      LIMIT 1
    `) as ReviewRow[];
    const [row] = rows;
    if (!row) {
      return res.status(404).json({ error: "Review not found" });
    }
    if (row.status !== "published") {
      return res
        .status(409)
        .json({ error: "Publish the review before sending it." });
    }
    const to = row.client_email?.trim();
    if (!to) {
      return res
        .status(409)
        .json({ error: "Add the client's email to the review first." });
    }

    const site = getSite();
    const url = `https://${site.domain}/review/${slug}`;
    const mail = reviewLinkEmail({
      brand: emailBrand(site),
      note,
      ownerName: site.ownerName,
      review: rowToReviewDto(row),
      url,
    });
    try {
      await sendEmail({ ...mail, replyTo: site.defaultAdminEmail, to });
    } catch (e) {
      if (e instanceof EmailNotConfiguredError) {
        return res
          .status(503)
          .json({ error: "Email is not configured on this deployment." });
      }
      console.error(`[review send → ${to}]`, e);
      return res.status(502).json({ error: "The email service refused it." });
    }

    await sql`
      UPDATE reviews SET sent_at = now(), sent_to = ${to}
      WHERE id = ${row.id}
    `;
    const fresh = (await sql`
      SELECT ${sql.unsafe(REVIEW_SELECT)}
      WHERE r.id = ${row.id}
    `) as ReviewRow[];
    const [current] = fresh;
    return res.status(200).json(
      current
        ? rowToReviewDto(current)
        : {
            ...rowToReviewDto(row),
            sent: { at: new Date().toISOString(), to },
          }
    );
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("sent_")) {
      return res.status(503).json({
        error:
          "Database schema is out of date. Run pnpm db:migrate against this deployment.",
      });
    }
    return res.status(500).json({ error: "Could not send the review" });
  }
}
