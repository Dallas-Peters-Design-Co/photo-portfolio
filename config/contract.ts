/**
 * The shape of a services agreement, and how one is drafted from a proposal.
 *
 * Shared by the admin editor, the client's signing page, the PDF and the API,
 * so it is validated once here. Clauses are plain text: an agreement is read
 * and signed, not designed, and plain text is what survives a PDF, an email
 * and a lawyer's markup unchanged.
 *
 * The default clauses are a sensible starting point for a small design
 * engagement, written plainly. They are not legal advice; the owner edits them
 * per client before sending.
 */
import {
  MAX_CLIENT_NAME,
  MAX_PROPOSAL_TITLE,
  newItemId,
  type ProposalDoc,
} from "./proposal.js";

export const MAX_CONTRACT_TITLE = MAX_PROPOSAL_TITLE;

export type ContractStatus = "draft" | "sent" | "signed" | "countersigned";
export const CONTRACT_STATUSES: ContractStatus[] = [
  "draft",
  "sent",
  "signed",
  "countersigned",
];

export interface ContractClause {
  body: string;
  heading: string;
  id: string;
}

/** What is being bought: the chosen option from the proposal, as agreed. */
export interface ContractScope {
  addOns: string[];
  includes: string[];
  option: string;
  payment: string;
  price: string;
  revisions: string;
  timeline: string;
}

export interface ContractParties {
  clientCompany: string;
  clientName: string;
  ownerBusiness: string;
  ownerName: string;
}

export interface ContractDoc {
  clauses: ContractClause[];
  /** ISO date the agreement takes effect, YYYY-MM-DD. */
  effectiveDate: string;
  parties: ContractParties;
  scope: ContractScope;
}

const MAX_SHORT = 200;
const MAX_LINE = 400;
const MAX_BODY = 4000;
const MAX_LIST = 40;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\0/g, "").slice(0, max) : "";

const lines = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [])
    .map((l) => str(l, MAX_LINE).trim())
    .filter(Boolean)
    .slice(0, MAX_LIST);

const cleanClause = (v: unknown): ContractClause => {
  const raw = (v ?? {}) as Partial<ContractClause>;
  return {
    body: str(raw.body, MAX_BODY),
    heading: str(raw.heading, MAX_SHORT),
    id: str(raw.id, 40) || newItemId(),
  };
};

/** Never throws: whatever arrives becomes a well-formed agreement. */
export const sanitizeContractDoc = (value: unknown): ContractDoc => {
  const raw = (value ?? {}) as Partial<ContractDoc>;
  const scope = (raw.scope ?? {}) as Partial<ContractScope>;
  const parties = (raw.parties ?? {}) as Partial<ContractParties>;
  const date = str(raw.effectiveDate, 10);
  return {
    clauses: (Array.isArray(raw.clauses) ? raw.clauses : [])
      .slice(0, MAX_LIST)
      .map(cleanClause),
    effectiveDate: ISO_DATE.test(date) ? date : "",
    parties: {
      clientCompany: str(parties.clientCompany, MAX_SHORT),
      clientName: str(parties.clientName, MAX_CLIENT_NAME),
      ownerBusiness: str(parties.ownerBusiness, MAX_SHORT),
      ownerName: str(parties.ownerName, MAX_SHORT),
    },
    scope: {
      addOns: lines(scope.addOns),
      includes: lines(scope.includes),
      option: str(scope.option, MAX_SHORT),
      payment: str(scope.payment, MAX_SHORT),
      price: str(scope.price, MAX_SHORT),
      revisions: str(scope.revisions, MAX_SHORT),
      timeline: str(scope.timeline, MAX_SHORT),
    },
  };
};

/**
 * The standard clauses. They name the parties by role, "the Designer" and "the
 * Client", which the header of the agreement defines, so a name never has to
 * be bent into a possessive and renaming a party never leaves a clause behind.
 */
export const defaultClauses = (): ContractClause[] =>
  [
    [
      "Services",
      "The Designer will provide the services described in the scope above. Changes to the scope are agreed in writing (email is fine). Work outside the scope is quoted separately before it starts.",
    ],
    [
      "Fees and payment",
      "The Client pays the fees on the payment schedule above. Invoices are sent through Stripe and are due within 14 days unless the invoice says otherwise. If a payment is more than 14 days late, the Designer may pause work until it is paid, and the timeline moves by the length of the pause.",
    ],
    [
      "Revisions and feedback",
      "Each deliverable includes the revision rounds listed above. Further rounds are billed at the add-on rate in the proposal. The Client gives feedback within two working days of each round; the timeline assumes it.",
    ],
    [
      "Ownership",
      "On full payment, the Designer assigns to the Client all rights in the final deliverables, including logos, source files and the drafts and explorations made for this project. Third-party material (fonts, stock imagery) is licensed rather than owned, in the Client's name where possible. The Designer's pre-existing tools, templates and methods stay the Designer's; the Client receives a perpetual licence to use any that are part of a deliverable.",
    ],
    [
      "Portfolio",
      "The Designer may show the work in a portfolio after it has been made public, unless the Client asks otherwise in writing.",
    ],
    [
      "Confidentiality",
      "Each party keeps the other's non-public information confidential and uses it only for this project. This continues after the agreement ends.",
    ],
    [
      "Independent contractor",
      "The Designer works as an independent contractor in a personal capacity, not as an employee or agent of the Client, and is responsible for their own taxes and tools.",
    ],
    [
      "Ending the agreement",
      "Either party may end this agreement with 14 days' written notice. Work completed up to the end date is invoiced, and everything made to that point is handed over on payment.",
    ],
    [
      "Liability",
      "To the Designer's knowledge the work is original and does not infringe anyone's rights. Each party's total liability under this agreement is limited to the fees paid under it.",
    ],
    [
      "General",
      "This agreement and the proposal it is based on are the whole agreement between the parties. It is governed by the laws of the State of Texas. Signatures made electronically are as binding as signatures on paper.",
    ],
  ].map(([heading = "", body = ""]) => ({ body, heading, id: newItemId() }));

const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * A first draft of the agreement from a proposal and the option the client
 * chose. Falls back to the recommended option, then the first, when none was
 * recorded.
 */
export const draftContractFromProposal = ({
  doc,
  option,
  clientName,
  clientCompany,
  ownerName,
  ownerBusiness,
}: {
  clientCompany: string;
  clientName: string;
  doc: ProposalDoc;
  option: string | null;
  ownerBusiness: string;
  ownerName: string;
}): ContractDoc => {
  const pkg =
    doc.packages.find((p) => p.id === option) ??
    doc.packages.find((p) => p.recommended) ??
    doc.packages[0];
  return sanitizeContractDoc({
    clauses: defaultClauses(),
    effectiveDate: today(),
    parties: { clientCompany, clientName, ownerBusiness, ownerName },
    scope: {
      addOns: [],
      includes: pkg?.includes ?? [],
      option: pkg?.name ?? "",
      payment: pkg?.payment ?? "",
      price: [pkg?.price, pkg?.priceNote].filter(Boolean).join(", "),
      revisions: pkg?.revisions ?? "",
      timeline: pkg?.timeline ?? "",
    },
  });
};
