import { createRequire } from "node:module";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFParse } from "pdf-parse";
import { beforeAll, describe, expect, it } from "vitest";
import type { ProposalRecord } from "../../services/proposalService";
import { registerProposalFonts } from "./fonts";
import { formatPdfDate, ProposalPdf } from "./ProposalPdf";

/**
 * The PDF, rendered for real and read back.
 *
 * What the client downloads has to say what the page says: the same clauses
 * in the same order with the same numbers, every price, the signature, and
 * nothing that was not in the record. react-pdf runs under Node, so the
 * document is rendered to bytes here and the text extracted again; a layout
 * regression that drops a clause or a fee would show up as missing text.
 */

const require = createRequire(import.meta.url);
const font = (file: string) =>
  require.resolve(`@fontsource/inter/files/${file}`);

const DOC: ProposalRecord["doc"] = {
  addOns: [
    { id: "a1", name: "Framer build", price: "+$1,500" },
    { id: "a2", name: "Launch video", price: "+$3,000" },
  ],
  closing: "Reply with the option you want.",
  intro: {
    content: [
      {
        content: [
          { text: "Thanks for the conversation, ", type: "text" },
          { marks: [{ type: "bold" }], text: "Vin", type: "text" },
          { text: ". ", type: "text" },
          {
            marks: [{ attrs: { href: "https://viask.ai" }, type: "link" }],
            text: "viask.ai",
            type: "text",
          },
        ],
        type: "paragraph",
      },
      {
        content: [
          {
            content: [
              {
                content: [{ text: "One bullet", type: "text" }],
                type: "paragraph",
              },
            ],
            type: "listItem",
          },
        ],
        type: "bulletList",
      },
    ],
    type: "doc",
  },
  packages: [
    {
      bestFor: "A quick read on what exists.",
      id: "pkg-audit",
      includes: ["Heuristic review", "Written findings"],
      name: "Audit",
      payment: "Paid up front",
      price: "$2,500",
      priceNote: "fixed",
      recommended: false,
      revisions: "One round",
      timeline: "1 week",
    },
    {
      bestFor: "Brand, product and promotion, together.",
      id: "pkg-launch",
      includes: ["Brand kit", "Product UI", "Launch page"],
      name: "Launch Package",
      payment: "50% to start, 50% at delivery",
      price: "$9,500",
      priceNote: "fixed",
      recommended: true,
      revisions: "Two rounds per stage",
      timeline: "6 weeks",
    },
  ],
  process: [
    { body: "You pick an option.", id: "s1", title: "Agree" },
    { body: "A 45-minute kickoff.", id: "s2", title: "Kickoff" },
  ],
  sections: [
    { body: "Small, direct, fast.", heading: "How I work", id: "sec1" },
    {
      body: "Weekly links.\n\n- One question per round\n- Replies in a day",
      heading: "What to expect",
      id: "sec2",
    },
  ],
  summary: "A product in search of a launch.",
  terms: ["Quote valid 30 days.", "Source files on final payment."],
  validUntil: "2026-11-15",
};

const PROPOSAL: ProposalRecord = {
  acceptance: null,
  brand: { accent: null, name: "Viaskai" },
  brandKitId: null,
  clientEmail: "vin@viask.ai",
  clientName: "Vin at Viaskai",
  createdAt: "2026-10-16T00:00:00.000Z",
  doc: DOC,
  id: "p1",
  sent: null,
  slug: "viaskai-pretext-launch",
  status: "published",
  title: "Pretext launch: brand, product and promotion",
  updatedAt: "2026-10-16T00:00:00.000Z",
};

const WHITESPACE = /\s+/g;

const render = async (proposal: ProposalRecord) => {
  const buffer = await renderToBuffer(
    ProposalPdf({
      domain: "dallaspeters.com",
      issued: "October 16, 2026",
      ownerName: "Dallas Peters",
      proposal,
      tagline: "Product Designer",
      validUntil: "November 15, 2026",
    })
  );
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  // Letter-spaced labels come back from the extractor one character at a
  // time ("S I G N E D"), so the text is also kept with spaces removed for
  // matching those.
  const text = (await parser.getText()).text.replace(WHITESPACE, " ");
  const info = await parser.getInfo();
  await parser.destroy();
  return {
    buffer,
    pages: info.total,
    squeezed: text.replace(WHITESPACE, ""),
    text,
  };
};

beforeAll(() => {
  registerProposalFonts({
    extrabold: font("inter-latin-800-normal.woff"),
    italic: font("inter-latin-400-italic.woff"),
    regular: font("inter-latin-400-normal.woff"),
    semibold: font("inter-latin-600-normal.woff"),
  });
});

describe("ProposalPdf", () => {
  it("is a PDF with the title and the parties", async () => {
    const { buffer, text, pages, squeezed } = await render(PROPOSAL);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(text).toContain("Pretext launch: brand, product and promotion");
    expect(text).toContain("Vin at Viaskai");
    expect(text).toContain("Viaskai");
    expect(text).toContain("Product Designer, dallaspeters.com");
    expect(squeezed).toContain("VALIDUNTILNOVEMBER15,2026");
  });

  it("numbers the clauses as the page does, in order", async () => {
    const { text } = await render(PROPOSAL);
    const titles = [
      "1. Scope of work",
      "2. How I work",
      "3. What to expect",
      "4. Options and fees",
      "5. Add-ons",
      "6. What happens next",
      "7. Terms",
      "8. Acceptance",
    ];
    let last = -1;
    for (const t of titles) {
      const at = text.indexOf(t);
      expect(at, t).toBeGreaterThan(last);
      last = at;
    }
  });

  it("carries every option, price, add-on, step and term", async () => {
    const { text } = await render(PROPOSAL);
    for (const s of [
      "4.1",
      "Audit.",
      "$2,500",
      "4.2",
      "Launch Package (suggested).",
      "$9,500",
      "fixed",
      "6 weeks · Two rounds per stage · 50% to start, 50% at delivery",
      "Brand kit",
      "Framer build",
      "+$1,500",
      "Agree.",
      "A 45-minute kickoff.",
      "Quote valid 30 days.",
      "Reply with the option you want.",
    ]) {
      expect(text, s).toContain(s);
    }
  });

  it("renders rich text: bold, links and lists, plus the plain-string form", async () => {
    const { text } = await render(PROPOSAL);
    expect(text).toContain("Thanks for the conversation, Vin. viask.ai");
    expect(text).toContain("• One bullet");
    expect(text).toContain("Weekly links.");
    expect(text).toContain("• One question per round");
  });

  it("leaves the client's line blank until signed, then fills it", async () => {
    const blank = await render(PROPOSAL);
    expect(blank.squeezed).toContain("SIGNEDFORVIASKAI");
    expect(blank.text).toContain("Name, title and date");
    expect(blank.squeezed).toContain("SIGNEDBYTHEDESIGNER");

    const signed = await render({
      ...PROPOSAL,
      acceptance: {
        at: "2026-10-16T20:00:00.000Z",
        name: "Vin Patel",
        option: "pkg-launch",
        title: "Founder",
      },
    });
    expect(signed.text).toContain("Vin Patel");
    expect(signed.text).toContain(
      "Founder · October 16, 2026 · Launch Package"
    );
    expect(signed.text).not.toContain("Name, title and date");
  });

  it("skips clauses the proposal does not have, without gaps", async () => {
    const { text } = await render({
      ...PROPOSAL,
      doc: {
        ...DOC,
        addOns: [],
        process: [],
        sections: [],
        summary: "",
        terms: [],
      },
    });
    expect(text).toContain("1. Options and fees");
    expect(text).toContain("2. Acceptance");
    expect(text).not.toContain("Add-ons");
  });

  it("numbers pages in the footer", async () => {
    const { text, pages } = await render(PROPOSAL);
    expect(text).toContain(`${PROPOSAL.title} · Dallas Peters · 1 / ${pages}`);
    expect(text).toContain(`${pages} / ${pages}`);
  });
});

describe("formatPdfDate", () => {
  it("reads a bare date as that day and ignores the locale", () => {
    expect(formatPdfDate("2026-11-15")).toBe("November 15, 2026");
    expect(formatPdfDate("soon")).toBe("soon");
  });
});
