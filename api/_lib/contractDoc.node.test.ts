import { describe, expect, it } from "vitest";
import {
  draftContractFromProposal,
  sanitizeContractDoc,
} from "../../config/contract.js";
import {
  DEFAULT_PROPOSAL_DOC,
  type ProposalDoc,
  type ProposalPackage,
} from "../../config/proposal.js";

/**
 * The agreement a proposal turns into: it must carry the option the client
 * actually chose, with its price and terms, and the parties' names in the
 * clauses, because that is what gets signed.
 */

const pkg = (over: Partial<ProposalPackage>): ProposalPackage => ({
  bestFor: "",
  id: "p",
  includes: [],
  name: "Option",
  payment: "",
  price: "",
  priceNote: "",
  recommended: false,
  revisions: "",
  timeline: "",
  ...over,
});

const doc: ProposalDoc = {
  ...DEFAULT_PROPOSAL_DOC,
  packages: [
    pkg({ id: "audit", name: "Audit", price: "$800" }),
    pkg({
      id: "launch",
      includes: ["Refined identity", "Landing page"],
      name: "Launch",
      payment: "50% to start, 50% at delivery",
      price: "$3,000",
      priceNote: "fixed",
      recommended: true,
      revisions: "2 rounds per deliverable",
      timeline: "4 to 6 weeks",
    }),
  ],
};

const draft = (option: string | null) =>
  draftContractFromProposal({
    clientCompany: "Viaskai",
    clientName: "Vin Gokhale",
    doc,
    option,
    ownerBusiness: "Dallas Peters Design",
    ownerName: "Dallas Peters",
  });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("draftContractFromProposal", () => {
  it("takes the scope from the option the client chose", () => {
    const { scope } = draft("audit");
    expect(scope.option).toBe("Audit");
    expect(scope.price).toBe("$800");
  });

  it("falls back to the recommended option, with its terms", () => {
    const { scope } = draft(null);
    expect(scope).toMatchObject({
      includes: ["Refined identity", "Landing page"],
      option: "Launch",
      payment: "50% to start, 50% at delivery",
      price: "$3,000, fixed",
      revisions: "2 rounds per deliverable",
      timeline: "4 to 6 weeks",
    });
  });

  it("names the parties by role in the clauses, and in full in the header", () => {
    const { clauses, parties, effectiveDate } = draft("launch");
    expect(parties).toMatchObject({
      clientCompany: "Viaskai",
      clientName: "Vin Gokhale",
      ownerName: "Dallas Peters",
    });
    const ownership = clauses.find((c) => c.heading === "Ownership");
    expect(ownership?.body).toContain("the Designer assigns to the Client");
    const text = clauses.map((c) => c.body).join(" ");
    expect(text).not.toContain("Dallas");
    expect(text).not.toContain("Vin");
    expect(clauses.find((c) => c.heading === "General")?.body).toContain(
      "Texas"
    );
    expect(effectiveDate).toMatch(ISO_DATE);
  });
});

describe("sanitizeContractDoc", () => {
  it("turns anything into a well-formed agreement", () => {
    const clean = sanitizeContractDoc({
      clauses: [{ body: 42, heading: "x".repeat(500) }, null],
      effectiveDate: "next tuesday",
      scope: { includes: ["  a  ", "", 7] },
    });
    expect(clean.effectiveDate).toBe("");
    expect(clean.scope.includes).toEqual(["a"]);
    expect(clean.clauses).toHaveLength(2);
    expect(clean.clauses[0]?.heading).toHaveLength(200);
    expect(clean.clauses[0]?.body).toBe("");
    expect(clean.clauses[1]?.id).toBeTruthy();
    expect(sanitizeContractDoc(null).parties.clientName).toBe("");
  });
});
