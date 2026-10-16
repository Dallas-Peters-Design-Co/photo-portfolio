import { describe, expect, it } from "vitest";
import type { EditorDoc, ProposalDoc } from "../../config/proposal.js";
import {
  acceptanceNoticeEmail,
  type ProposalEmailInput,
  proposalCopyEmail,
  proposalLinkEmail,
  richTextToHtml,
} from "./proposalEmail.js";
import type { ProposalDto } from "./proposals.js";

/**
 * The signed copy a client receives.
 *
 * This is the record of what was agreed, so what matters is that every clause
 * the page showed is in the mail, in the same order and with the same numbers,
 * that the option they chose is the one marked, and that nothing a client (or
 * an admin) typed can put markup into it. None of that is checked anywhere
 * else: the page renders from the doc through React, the mail renders from the
 * same doc through string concatenation, and only the second one can drift
 * silently.
 */

const ONE_ITEM_LIST = /<ul[^>]*><li[^>]*>One<\/li><\/ul>/;
const FIRST_PARAGRAPH = /^<p[^>]*>First\.<\/p>/;
const TWO_ITEM_LIST = /<li[^>]*>a<\/li><li[^>]*>b<\/li>/;

const editorDoc = (...paragraphs: string[]): EditorDoc => ({
  content: paragraphs.map((text) => ({
    content: [{ text, type: "text" }],
    type: "paragraph",
  })),
  type: "doc",
});

const DOC: ProposalDoc = {
  addOns: [
    { id: "add-framer", name: "Framer build", price: "+$1,500" },
    { id: "add-video", name: "Launch video", price: "+$3,000" },
  ],
  closing: "Reply with the option you want.",
  intro: editorDoc("Thanks for the conversation, Vin."),
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
    { body: "You pick an option.", id: "step-agree", title: "Agree" },
    { body: "A 45-minute kickoff.", id: "step-kickoff", title: "Kickoff" },
  ],
  sections: [
    {
      body: editorDoc("Small, direct, fast."),
      heading: "How I work",
      id: "s1",
    },
    {
      body: "Weekly links.\n\nOne question per round.",
      heading: "What to expect",
      id: "s2",
    },
  ],
  summary: editorDoc("A product in search of a launch."),
  terms: ["Quote valid 30 days.", "Source files on final payment."],
  validUntil: "2026-11-15",
};

const PROPOSAL: ProposalDto = {
  acceptance: null,
  brand: { accent: "#172a3a", name: "Viaskai" },
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

const BRAND = {
  domain: "dallaspeters.com",
  key: "dallas-images",
  ownerName: "Dallas Peters",
  tagline: "Product Designer",
};

const input = (over: Partial<ProposalEmailInput> = {}): ProposalEmailInput => ({
  acceptedName: "Vin Patel",
  acceptedTitle: "Founder",
  brand: BRAND,
  chosen: { name: "Launch Package", price: "$9,500" },
  ownerName: "Dallas Peters",
  proposal: PROPOSAL,
  url: "https://dallaspeters.com/proposal/viaskai-pretext-launch",
  ...over,
});

/** The order headings appear in the HTML, by their clause number. */
const clauseOrder = (html: string): string[] =>
  [...html.matchAll(/<h2[^>]*>(\d+)\. ([^<]+)<\/h2>/g)].map(
    (m) => `${m[1]}. ${m[2]}`
  );

describe("richTextToHtml", () => {
  it("renders the editor's blocks and marks", () => {
    const html = richTextToHtml({
      content: [
        { content: [{ text: "Scope", type: "text" }], type: "heading" },
        {
          content: [
            { marks: [{ type: "bold" }], text: "Bold", type: "text" },
            { text: " and ", type: "text" },
            { marks: [{ type: "italic" }], text: "italic", type: "text" },
            {
              marks: [{ attrs: { href: "https://viask.ai" }, type: "link" }],
              text: "a link",
              type: "text",
            },
          ],
          type: "paragraph",
        },
        {
          content: [
            {
              content: [
                { content: [{ text: "One", type: "text" }], type: "paragraph" },
              ],
              type: "listItem",
            },
          ],
          type: "bulletList",
        },
      ],
      type: "doc",
    });
    expect(html).toContain("<h3");
    expect(html).toContain("Scope</h3>");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('<a href="https://viask.ai">a link</a>');
    expect(html).toMatch(ONE_ITEM_LIST);
  });

  it("escapes text so a doc cannot inject markup into the mail", () => {
    const html = richTextToHtml(
      editorDoc('<script>alert("x")</script> & <img src=x onerror=1>')
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("escapes link targets too", () => {
    const html = richTextToHtml({
      content: [
        {
          content: [
            {
              marks: [
                { attrs: { href: '" onmouseover="alert(1)' }, type: "link" },
              ],
              text: "x",
              type: "text",
            },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    });
    expect(html).not.toContain('onmouseover="alert');
    expect(html).toContain("&quot; onmouseover=&quot;alert(1)");
  });

  it("turns a plain string into paragraphs and lists", () => {
    const html = richTextToHtml("First.\n\n- a\n- b");
    expect(html).toMatch(FIRST_PARAGRAPH);
    expect(html).toMatch(TWO_ITEM_LIST);
  });

  it("reduces an image to its link rather than embedding it", () => {
    const html = richTextToHtml({
      content: [{ attrs: { src: "https://x.test/a.png" }, type: "image" }],
      type: "doc",
    });
    expect(html).toContain('<a href="https://x.test/a.png">Image</a>');
    expect(html).not.toContain("<img");
  });
});

describe("proposalCopyEmail", () => {
  it("numbers every clause in the order the page shows them", () => {
    const { html } = proposalCopyEmail(input());
    expect(clauseOrder(html)).toEqual([
      "1. Scope of work",
      "2. How I work",
      "3. What to expect",
      "4. Options and fees",
      "5. Add-ons",
      "6. What happens next",
      "7. Terms",
      "8. Acceptance",
    ]);
  });

  it("carries the title, intro, options, prices and terms", () => {
    const { html, text, subject } = proposalCopyEmail(input());
    expect(subject).toBe(`Your signed copy: ${PROPOSAL.title}`);
    for (const body of [html, text]) {
      expect(body).toContain(PROPOSAL.title);
      expect(body).toContain("Thanks for the conversation, Vin.");
      expect(body).toContain("4.1 Audit");
      expect(body).toContain("$2,500");
      expect(body).toContain("4.2 Launch Package");
      expect(body).toContain("$9,500");
      expect(body).toContain("Brand kit");
      expect(body).toContain("Framer build");
      expect(body).toContain("+$1,500");
      expect(body).toContain("Quote valid 30 days.");
      expect(body).toContain("Kickoff");
      expect(body).toContain("Weekly links.");
      expect(body).toContain(
        "https://dallaspeters.com/proposal/viaskai-pretext-launch"
      );
    }
  });

  it("marks the accepted option and no other", () => {
    const { html } = proposalCopyEmail(input());
    expect(html).toContain("Launch Package (accepted)");
    expect(html).not.toContain("Audit (accepted)");
  });

  it("records who accepted, their title, the option and who signed", () => {
    const { html, text } = proposalCopyEmail(input());
    expect(html).toContain("Accepted by <strong>Vin Patel, Founder</strong>");
    expect(html).toContain("for <strong>Launch Package</strong> ($9,500)");
    expect(html).toContain("Signed by Dallas Peters.");
    expect(text).toContain(
      "Accepted by Vin Patel, Founder for Launch Package ($9,500)."
    );
    expect(text).toContain("Signed by Dallas Peters.");
  });

  it("copes with no title and no option", () => {
    const { html, text } = proposalCopyEmail(
      input({ acceptedTitle: "", chosen: null })
    );
    expect(html).toContain("Accepted by <strong>Vin Patel</strong>.");
    expect(html).not.toContain("(accepted)");
    expect(text).toContain("Accepted by Vin Patel.");
  });

  it("skips clauses the proposal does not have, without leaving gaps", () => {
    const bare: ProposalDoc = {
      ...DOC,
      addOns: [],
      process: [],
      sections: [],
      summary: "",
      terms: [],
    };
    const { html } = proposalCopyEmail(
      input({ proposal: { ...PROPOSAL, doc: bare } })
    );
    expect(clauseOrder(html)).toEqual(["1. Options and fees", "2. Acceptance"]);
  });

  it("escapes what the client typed on the signature line", () => {
    const { html } = proposalCopyEmail(
      input({ acceptedName: '<b>Vin</b> "Patel"', acceptedTitle: "<i>CEO</i>" })
    );
    expect(html).not.toContain("<b>Vin</b>");
    expect(html).not.toContain("<i>CEO</i>");
    expect(html).toContain("&lt;b&gt;Vin&lt;/b&gt; &quot;Patel&quot;");
  });

  it("greets by first name and points at the online copy", () => {
    const { html } = proposalCopyEmail(input());
    expect(html).toContain("Thanks, Vin.");
    expect(html).toContain(
      'href="https://dallaspeters.com/proposal/viaskai-pretext-launch"'
    );
  });

  it("is inline-styled HTML with no stylesheet to lose", () => {
    const { html } = proposalCopyEmail(input());
    expect(html).not.toContain("<style");
    expect(html).not.toContain("<link");
    expect(html).not.toContain('class="');
  });

  it("sits in the branded frame: logo, wordmark, blue rule, footer", () => {
    for (const mail of [
      proposalCopyEmail(input()),
      acceptanceNoticeEmail(input()),
      proposalLinkEmail({
        brand: BRAND,
        note: "",
        ownerName: "Dallas Peters",
        proposal: PROPOSAL,
        url: "https://dallaspeters.com/proposal/x",
      }),
    ]) {
      expect(mail.html).toContain(
        'src="https://dallaspeters.com/sites/dallas-images/logo-email.png"'
      );
      expect(mail.html).toContain("border-top:8px solid #0e29f1");
      expect(mail.html).toContain("Dallas Peters · Product Designer");
      expect(mail.html).toContain('href="https://dallaspeters.com"');
      expect(mail.html).toContain("<!doctype html>");
      expect(mail.html).not.toContain("<svg");
    }
  });
});

describe("acceptanceNoticeEmail", () => {
  it("tells the owner who, what, which option and where", () => {
    const { subject, text, html } = acceptanceNoticeEmail(input());
    expect(subject).toBe(`Accepted: ${PROPOSAL.title}`);
    expect(text).toContain(`Vin Patel, Founder accepted "${PROPOSAL.title}".`);
    expect(text).toContain("Option: Launch Package ($9,500)");
    expect(text).toContain("Client: Vin at Viaskai");
    expect(text).toContain(
      "https://dallaspeters.com/proposal/viaskai-pretext-launch"
    );
    expect(html).toContain("Vin Patel, Founder accepted");
  });

  it("leaves out the lines it has nothing for", () => {
    const { text } = acceptanceNoticeEmail(
      input({
        acceptedTitle: "",
        chosen: null,
        proposal: { ...PROPOSAL, clientName: "" },
      })
    );
    expect(text).not.toContain("Option:");
    expect(text).not.toContain("Client:");
    expect(text).toContain(`Vin Patel accepted "${PROPOSAL.title}".`);
  });
});

describe("proposalLinkEmail", () => {
  it("greets by first name, carries the note and the link, signs off", () => {
    const { subject, html, text } = proposalLinkEmail({
      brand: BRAND,
      note: "Good talking yesterday.\n\nHere it is, as promised.",
      ownerName: "Dallas Peters",
      proposal: PROPOSAL,
      url: "https://dallaspeters.com/proposal/viaskai-pretext-launch",
    });
    expect(subject).toBe(`Proposal: ${PROPOSAL.title}`);
    for (const body of [html, text]) {
      expect(body).toContain("Hi Vin,");
      expect(body).toContain("Good talking yesterday.");
      expect(body).toContain("Here it is, as promised.");
      expect(body).toContain("save it as a PDF");
      expect(body).toContain("The pricing holds until November 15, 2026.");
      expect(body).toContain(
        "https://dallaspeters.com/proposal/viaskai-pretext-launch"
      );
      expect(body).toContain("Dallas Peters");
    }
    expect(html).toContain(">Open the proposal</a>");
    // Once in the inbox preheader, once in the body; never doubled in the body.
    expect(html.split("Good talking yesterday.")).toHaveLength(3);
    expect(text.split("Good talking yesterday.")).toHaveLength(2);
  });

  it("falls back to a default note and a plain greeting", () => {
    const { text } = proposalLinkEmail({
      brand: BRAND,
      note: "   ",
      ownerName: "Dallas Peters",
      proposal: {
        ...PROPOSAL,
        clientName: "",
        doc: { ...DOC, validUntil: "" },
      },
      url: "https://dallaspeters.com/proposal/x",
    });
    expect(text).toContain("Hi,");
    expect(text).toContain("Here's the proposal we talked about.");
    expect(text).not.toContain("pricing holds");
  });

  it("escapes the note, so a pasted angle bracket is text", () => {
    const { html } = proposalLinkEmail({
      brand: BRAND,
      note: "Costs <$10k> & change",
      ownerName: "Dallas",
      proposal: PROPOSAL,
      url: "https://dallaspeters.com/proposal/x",
    });
    expect(html).toContain("Costs &lt;$10k&gt; &amp; change");
  });
});
