/**
 * The proposal as an email: the copy the client gets when they accept, and
 * the note the owner gets.
 *
 * Plain HTML with inline styles, since mail clients ignore stylesheets. The
 * rich-text bodies are walked directly: paragraphs, headings, lists, bold,
 * italic and links, which is what the CMS editor produces. Anything else
 * (an image, a video) becomes its link or is skipped; a signed copy is a
 * record, not a layout.
 */
import {
  type ProposalDoc,
  type RichText,
  textToBlocks,
} from "../../config/proposal.js";
import type { ProposalDto } from "./proposals.js";

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface Node {
  attrs?: Record<string, unknown>;
  content?: Node[];
  marks?: { attrs?: Record<string, unknown>; type: string }[];
  text?: string;
  type?: string;
}

const P = 'style="margin:0 0 12px;font-size:15px;line-height:1.6"';
const H = 'style="margin:28px 0 8px;font-size:17px;line-height:1.3"';
const LI = 'style="margin:0 0 6px;font-size:15px;line-height:1.5"';

const applyMark = (
  out: string,
  mark: { attrs?: Record<string, unknown>; type: string }
): string => {
  if (mark.type === "bold") {
    return `<strong>${out}</strong>`;
  }
  if (mark.type === "italic") {
    return `<em>${out}</em>`;
  }
  if (mark.type === "link") {
    const href = String(mark.attrs?.href ?? "");
    return href ? `<a href="${escapeHtml(href)}">${out}</a>` : out;
  }
  return out;
};

const inline = (nodes: Node[] | undefined): string =>
  (nodes ?? [])
    .map((n) => {
      if (n.type === "hardBreak") {
        return "<br>";
      }
      if (typeof n.text !== "string") {
        return "";
      }
      return (n.marks ?? []).reduce(applyMark, escapeHtml(n.text));
    })
    .join("");

const block = (n: Node): string => {
  switch (n.type) {
    case "paragraph":
      return `<p ${P}>${inline(n.content)}</p>`;
    case "heading":
      return `<h3 ${H}>${inline(n.content)}</h3>`;
    case "bulletList":
      return `<ul style="margin:0 0 12px;padding-left:20px">${(n.content ?? []).map(block).join("")}</ul>`;
    case "orderedList":
      return `<ol style="margin:0 0 12px;padding-left:20px">${(n.content ?? []).map(block).join("")}</ol>`;
    case "listItem":
      return `<li ${LI}>${(n.content ?? []).map((c) => (c.type === "paragraph" ? inline(c.content) : block(c))).join("")}</li>`;
    case "blockquote":
      return `<blockquote style="margin:0 0 12px;padding-left:12px;border-left:2px solid #ccc">${(n.content ?? []).map(block).join("")}</blockquote>`;
    case "image": {
      const src = String(n.attrs?.src ?? "");
      return src ? `<p ${P}><a href="${escapeHtml(src)}">Image</a></p>` : "";
    }
    default:
      return (n.content ?? []).map(block).join("");
  }
};

export const richTextToHtml = (value: RichText): string => {
  if (typeof value !== "string") {
    return (value.content as Node[]).map(block).join("");
  }
  return textToBlocks(value)
    .map((b) =>
      b.kind === "list"
        ? `<ul style="margin:0 0 12px;padding-left:20px">${b.items.map((i) => `<li ${LI}>${escapeHtml(i)}</li>`).join("")}</ul>`
        : `<p ${P}>${escapeHtml(b.text)}</p>`
    )
    .join("");
};

const richTextToText = (value: RichText): string => {
  if (typeof value === "string") {
    return value;
  }
  const walk = (n: Node): string => {
    if (typeof n.text === "string") {
      return n.text;
    }
    const inner = (n.content ?? []).map(walk).join("");
    return n.type === "paragraph" ||
      n.type === "heading" ||
      n.type === "listItem"
      ? `${inner}\n`
      : inner;
  };
  return (value.content as Node[]).map(walk).join("\n").trim();
};

export interface ProposalEmailInput {
  acceptedName: string;
  acceptedTitle: string;
  chosen: { name: string; price: string } | null;
  ownerName: string;
  proposal: ProposalDto;
  url: string;
}

/** The signed copy, for the client. */
export const proposalCopyEmail = ({
  proposal,
  acceptedName,
  acceptedTitle,
  chosen,
  ownerName,
  url,
}: ProposalEmailInput) => {
  const doc: ProposalDoc = proposal.doc;
  const parts: string[] = [];
  const textParts: string[] = [];
  let n = 0;
  const clause = (title: string, body: string, plain: string) => {
    n += 1;
    parts.push(
      `<h2 ${H.replace("17px", "19px")}>${n}. ${escapeHtml(title)}</h2>${body}`
    );
    textParts.push(`${n}. ${title}\n${plain}\n`);
  };

  if (doc.summary) {
    clause(
      "Scope of work",
      richTextToHtml(doc.summary),
      richTextToText(doc.summary)
    );
  }
  for (const s of doc.sections) {
    clause(s.heading, richTextToHtml(s.body), richTextToText(s.body));
  }
  if (doc.packages.length > 0) {
    const html = doc.packages
      .map((p, idx) => {
        const mark = chosen && p.name === chosen.name ? " (accepted)" : "";
        const facts = [p.timeline, p.revisions, p.payment]
          .filter(Boolean)
          .join(" · ");
        return `<p ${P}><strong>${n + 1}.${idx + 1} ${escapeHtml(p.name)}${mark}</strong> — ${escapeHtml(p.price)}${p.priceNote ? ` ${escapeHtml(p.priceNote)}` : ""}<br>${escapeHtml(p.bestFor)}${facts ? `<br><span style="color:#666">${escapeHtml(facts)}</span>` : ""}</p>${p.includes.length ? `<ul style="margin:0 0 16px;padding-left:20px">${p.includes.map((line) => `<li ${LI}>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}`;
      })
      .join("");
    const plain = doc.packages
      .map(
        (p, i) =>
          `${n + 1}.${i + 1} ${p.name} — ${p.price} ${p.priceNote}\n${p.bestFor}\n${p.includes.map((x) => `  - ${x}`).join("\n")}`
      )
      .join("\n\n");
    clause("Options and fees", html, plain);
  }
  if (doc.addOns.length > 0) {
    clause(
      "Add-ons",
      `<ul style="margin:0 0 12px;padding-left:20px">${doc.addOns.map((a) => `<li ${LI}>${escapeHtml(a.name)} — ${escapeHtml(a.price)}</li>`).join("")}</ul>`,
      doc.addOns.map((a) => `  - ${a.name} — ${a.price}`).join("\n")
    );
  }
  if (doc.process.length > 0) {
    clause(
      "What happens next",
      `<ol style="margin:0 0 12px;padding-left:20px">${doc.process.map((s) => `<li ${LI}><strong>${escapeHtml(s.title)}.</strong> ${escapeHtml(s.body)}</li>`).join("")}</ol>`,
      doc.process.map((s, i) => `  ${i + 1}. ${s.title}. ${s.body}`).join("\n")
    );
  }
  if (doc.terms.length > 0) {
    clause(
      "Terms",
      `<ul style="margin:0 0 12px;padding-left:20px">${doc.terms.map((t) => `<li ${LI}>${escapeHtml(t)}</li>`).join("")}</ul>`,
      doc.terms.map((t) => `  - ${t}`).join("\n")
    );
  }
  const signed = `${acceptedName}${acceptedTitle ? `, ${acceptedTitle}` : ""}`;
  clause(
    "Acceptance",
    `<p ${P}>Accepted by <strong>${escapeHtml(signed)}</strong>${chosen ? ` for <strong>${escapeHtml(chosen.name)}</strong> (${escapeHtml(chosen.price)})` : ""}.</p><p ${P}>Signed by ${escapeHtml(ownerName)}.</p>`,
    `Accepted by ${signed}${chosen ? ` for ${chosen.name} (${chosen.price})` : ""}.\nSigned by ${ownerName}.`
  );

  const subject = `Your signed copy: ${proposal.title}`;
  const intro = `<p ${P}>Thanks, ${escapeHtml(acceptedName.split(" ")[0] ?? acceptedName)}. This is your copy of the proposal you accepted. It stays online at <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>.</p>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#666">Design proposal</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.2">${escapeHtml(proposal.title)}</h1>
${intro}${richTextToHtml(doc.intro)}${parts.join("")}
<p style="margin:28px 0 0;font-size:13px;color:#666">${escapeHtml(ownerName)}</p></div>`;
  const text = [
    proposal.title,
    "",
    `Your copy of the proposal you accepted. It stays online at ${url}`,
    "",
    richTextToText(doc.intro),
    "",
    ...textParts,
    ownerName,
  ].join("\n");
  return { html, subject, text };
};

/** The note to the owner. */
export const acceptanceNoticeEmail = ({
  proposal,
  acceptedName,
  acceptedTitle,
  chosen,
  url,
}: ProposalEmailInput) => {
  const who = acceptedTitle
    ? `${acceptedName}, ${acceptedTitle}`
    : acceptedName;
  const lines = [
    `${who} accepted "${proposal.title}".`,
    chosen ? `Option: ${chosen.name} (${chosen.price})` : "",
    proposal.clientName ? `Client: ${proposal.clientName}` : "",
    url,
  ].filter((l) => l !== "");
  return {
    html: lines.map((l) => `<p ${P}>${escapeHtml(l)}</p>`).join(""),
    subject: `Accepted: ${proposal.title}`,
    text: lines.join("\n"),
  };
};

export interface ProposalLinkInput {
  /** A few lines from the owner above the link, or empty for the default. */
  note: string;
  ownerName: string;
  proposal: ProposalDto;
  url: string;
}

const WORD_BREAK = /\s+/;
const PARAGRAPH_BREAK = /\n\s*\n/;
const LINE_BREAK = /\n/g;

const firstName = (label: string): string =>
  label.trim().split(WORD_BREAK)[0] ?? "";

/**
 * The email that sends the proposal to the client: a short note and the
 * link. The proposal itself stays on the page, where it can be read, saved as
 * a PDF and accepted; the mail is the invitation, not the document.
 */
export const proposalLinkEmail = ({
  proposal,
  note,
  ownerName,
  url,
}: ProposalLinkInput) => {
  const who = firstName(proposal.clientName);
  const greeting = who ? `Hi ${who},` : "Hi,";
  const body = note.trim()
    ? note.trim()
    : "Here's the proposal we talked about. It covers what I heard, how I'd approach it, and the options with pricing.";
  const until = proposal.doc.validUntil
    ? ` The pricing holds until ${proposal.doc.validUntil}.`
    : "";
  const how = `You can read it at the link below, save it as a PDF from the page, and accept it there when you're ready.${until} Reply to this email with any questions.`;

  const paragraphs = body
    .split(PARAGRAPH_BREAK)
    .map((p) => p.trim())
    .filter(Boolean);
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px">
<p ${P}>${escapeHtml(greeting)}</p>
${paragraphs.map((p) => `<p ${P}>${escapeHtml(p).replace(LINE_BREAK, "<br>")}</p>`).join("")}
<p ${P}>${escapeHtml(how)}</p>
<p ${P}><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;border:1px solid #111;color:#111;text-decoration:none">Open the proposal</a></p>
<p ${P}><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
<p style="margin:28px 0 0;font-size:13px;color:#666">${escapeHtml(ownerName)}</p></div>`;
  const text = [greeting, "", body, "", how, "", url, "", ownerName].join("\n");
  return { html, subject: `Proposal: ${proposal.title}`, text };
};
