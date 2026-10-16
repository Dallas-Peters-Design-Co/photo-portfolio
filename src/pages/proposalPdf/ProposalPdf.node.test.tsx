import { createRequire } from "node:module";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFParse } from "pdf-parse";
import { beforeAll, describe, expect, it } from "vitest";
import { STATIC_FONTS } from "../../../config/staticFonts";
import type { ProposalRecord } from "../../services/proposalService";
import {
  nearestCut,
  pdfFontFiles,
  pdfFontFor,
  registerProposalFonts,
} from "./fonts";
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
const font = (file: string) => require.resolve(`@fontsource/${file}`);

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
const FOOTER = /Pretext launch.*$/;
const BARE_TITLE_AT_END = /\d+\. [A-Za-z ]+$/;

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
  const result = await parser.getText();
  const text = result.text.replace(WHITESPACE, " ");
  const pageTexts = result.pages.map((p) => p.text.replace(WHITESPACE, " "));
  const info = await parser.getInfo();
  await parser.destroy();
  return {
    buffer,
    pages: info.total,
    pageTexts,
    squeezed: text.replace(WHITESPACE, ""),
    text,
  };
};

const sources = (id: Parameters<typeof pdfFontFiles>[0]) => {
  const files = pdfFontFiles(id);
  return {
    id,
    src: {
      extrabold: font(files.extrabold),
      italic: font(files.italic),
      regular: font(files.regular),
      semibold: font(files.semibold),
    },
  };
};

beforeAll(() => {
  // Body in Inter, titles in the condensed face: the two-family case.
  registerProposalFonts(sources("inter"), sources("barlow-semi-condensed"));
});

describe("pdf fonts", () => {
  it("uses any static family and the variable ones with a static twin, Inter otherwise", () => {
    expect(pdfFontFor("barlow-semi-condensed")).toBe("barlow-semi-condensed");
    expect(pdfFontFor("oswald")).toBe("oswald");
    expect(pdfFontFor("dm-serif-display")).toBe("dm-serif-display");
    expect(pdfFontFor("figtree")).toBe("figtree");
    expect(pdfFontFor("geist")).toBe("inter");
    expect(pdfFontFor("space-grotesk")).toBe("inter");
  });

  it("picks the nearest cut a family ships and borrows regular for a missing italic", () => {
    expect(nearestCut([200, 300, 400, 500, 600, 700], 800)).toBe(700);
    expect(nearestCut([400], 600)).toBe(400);
    const bebas = pdfFontFiles("bebas-neue");
    expect(bebas.extrabold).toBe(
      "bebas-neue/files/bebas-neue-latin-400-normal.woff"
    );
    expect(bebas.italic).toBe(
      "bebas-neue/files/bebas-neue-latin-400-normal.woff"
    );
    const oswald = pdfFontFiles("oswald");
    expect(oswald.extrabold).toBe("oswald/files/oswald-latin-700-normal.woff");
    expect(oswald.semibold).toBe("oswald/files/oswald-latin-600-normal.woff");
  });

  it("names four files that exist for every family it offers", () => {
    const ids = [
      "inter",
      "figtree",
      "mulish",
      ...STATIC_FONTS.map((f) => f.id),
    ] as const;
    for (const id of ids) {
      for (const file of Object.values(pdfFontFiles(id))) {
        expect(() => font(file), file).not.toThrow();
      }
    }
  });

  it("embeds both families in the file: body and titles", async () => {
    const { buffer } = await render(PROPOSAL);
    const raw = buffer.toString("latin1");
    expect(raw).toContain("BarlowSemiCondensed");
    expect(raw).toContain("Inter");
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

describe("ProposalPdf page breaks", () => {
  it("keeps every clause on one page, title with its body", async () => {
    // Enough sections of a size that some must move to a later page.
    const body = Array.from(
      { length: 6 },
      (_, i) =>
        `Paragraph ${i + 1} of this section, long enough to take a line or two on the page when set at the body size.`
    ).join("\n\n");
    const sections = Array.from({ length: 7 }, (_, i) => ({
      body,
      heading: `Section ${i + 1}`,
      id: `sec-${i}`,
    }));
    const { pageTexts, pages } = await render({
      ...PROPOSAL,
      doc: { ...DOC, sections },
    });
    expect(pages).toBeGreaterThan(2);

    for (const [i, section] of sections.entries()) {
      const title = `${i + 2}. ${section.heading}`;
      const page = pageTexts.find((t) => t.includes(title));
      expect(page, `${title} is on some page`).toBeDefined();
      // Its first and last paragraph sit on the same page as the title.
      expect(page, `${title} starts on its page`).toContain(
        "Paragraph 1 of this section"
      );
      expect(page, `${title} ends on its page`).toContain(
        "Paragraph 6 of this section"
      );
      // And the next clause's title, when on the same page, comes after
      // this clause's last paragraph; nothing of this clause spills over.
      const nextTitle =
        i + 1 < sections.length ? `${i + 3}. ${sections[i + 1]?.heading}` : "";
      if (nextTitle && page?.includes(nextTitle)) {
        expect(page.indexOf(nextTitle)).toBeGreaterThan(page.indexOf(title));
      }
    }
    // No page ends on a bare clause title.
    for (const t of pageTexts) {
      const stripped = t.replace(FOOTER, "").trim();
      expect(stripped).not.toMatch(BARE_TITLE_AT_END);
    }
  });

  it("keeps the signature block whole", async () => {
    const { pageTexts } = await render(PROPOSAL);
    const page = pageTexts.find((t) => t.includes("8. Acceptance"));
    expect(page).toContain("Name, title and date");
    expect(page?.replace(WHITESPACE, "")).toContain("SIGNEDBYTHEDESIGNER");
  });
});

describe("formatPdfDate", () => {
  it("reads a bare date as that day and ignores the locale", () => {
    expect(formatPdfDate("2026-11-15")).toBe("November 15, 2026");
    expect(formatPdfDate("soon")).toBe("soon");
  });
});
