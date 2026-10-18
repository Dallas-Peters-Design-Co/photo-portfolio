import {
  button,
  type EmailBrand,
  emailFrame,
  escapeHtml,
  P,
  SOFT,
} from "./emailLayout.js";
import type { ReviewDto } from "./reviews.js";

/**
 * The email that sends a review to the client: a note and the link, in the
 * same frame as the proposal mails. The review stays on the page.
 */
export interface ReviewLinkInput {
  brand: EmailBrand;
  note: string;
  ownerName: string;
  review: ReviewDto;
  url: string;
}

const WORD_BREAK = /\s+/;
const PARAGRAPH_BREAK = /\n\s*\n/;
const LINE_BREAK = /\n/g;

export const reviewLinkEmail = ({
  brand,
  review,
  note,
  ownerName,
  url,
}: ReviewLinkInput) => {
  const who = review.clientName.trim().split(WORD_BREAK)[0] ?? "";
  const greeting = who ? `Hi ${who},` : "Hi,";
  const notes = review.doc.screens.reduce((n, s) => n + s.pins.length, 0);
  const body = note.trim()
    ? note.trim()
    : `Here's my review of the site: ${review.doc.screens.length} screens with ${notes} numbered notes on what works, what gets in the way, and what I'd change.`;
  const how =
    "Each screenshot has numbered pins; the notes under it match the numbers. Reply to this email with any questions.";
  // The first captured screen, so the client sees the work before clicking
  // through. Plain screenshot: pins and markup live on the page, where they
  // can sit beside their notes.
  const lead = review.doc.screens.find((s) => s.image);
  const preview = lead?.image
    ? `<p style="margin:0 0 20px"><a href="${escapeHtml(url)}"><img alt="${escapeHtml(lead.title || review.title)}" src="${escapeHtml(lead.image.url)}" style="display:block;width:100%;max-width:560px;height:auto;border:1px solid #e5e5e5;border-radius:6px" width="560"></a></p>`
    : "";
  const paragraphs = body
    .split(PARAGRAPH_BREAK)
    .map((p) => p.trim())
    .filter(Boolean);
  const html = emailFrame({
    brand,
    content: `<p ${P}>${escapeHtml(greeting)}</p>
${paragraphs.map((p) => `<p ${P}>${escapeHtml(p).replace(LINE_BREAK, "<br>")}</p>`).join("")}
${preview}
<p ${P}>${escapeHtml(how)}</p>
${button(url, "Open the review")}
<p ${SOFT}><a href="${escapeHtml(url)}" style="color:inherit">${escapeHtml(url)}</a></p>
<p ${P}>${escapeHtml(ownerName)}</p>`,
    kicker: "Site review",
    preheader: paragraphs[0] ?? "",
    title: review.title,
  });
  const text = [greeting, "", body, "", how, "", url, "", ownerName].join("\n");
  return { html, subject: `Review: ${review.title}`, text };
};
