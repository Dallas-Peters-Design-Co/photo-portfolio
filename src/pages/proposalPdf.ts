import type { ProposalRecord } from "../services/proposalService";
import { downloadPagePdf } from "./pagePdf";

/**
 * "Download PDF": the API prints the public page with a real browser and
 * hands the file back. One rendering of the proposal, the page's own, so
 * the PDF follows ProposalPage.css without a second layout to maintain.
 */
export const proposalPdfFilename = (proposal: ProposalRecord): string =>
  `proposal-${proposal.slug}.pdf`;

export const downloadProposalPdf = (proposal: ProposalRecord): Promise<void> =>
  downloadPagePdf(
    `/api/proposals/${encodeURIComponent(proposal.slug)}/pdf`,
    proposalPdfFilename(proposal)
  );
