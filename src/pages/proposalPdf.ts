import {
  apiBase,
  jsonHeaders,
  readPageError,
} from "../services/portfolioService";
import type { ProposalRecord } from "../services/proposalService";

/**
 * "Download PDF": the API prints the public page with a real browser and
 * hands the file back. One rendering of the proposal, the page's own, so
 * the PDF follows ProposalPage.css without a second layout to maintain.
 */
export const proposalPdfFilename = (proposal: ProposalRecord): string =>
  `proposal-${proposal.slug}.pdf`;

export const downloadProposalPdf = async (
  proposal: ProposalRecord
): Promise<void> => {
  const res = await fetch(
    `${apiBase()}/api/proposals/${encodeURIComponent(proposal.slug)}/pdf`,
    {
      body: JSON.stringify({ origin: window.location.origin }),
      headers: jsonHeaders(),
      method: "POST",
    }
  );
  if (!res.ok) {
    throw new Error(await readPageError(res, "Could not make the PDF"));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = proposalPdfFilename(proposal);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
