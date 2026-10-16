import type { ProposalRecord } from "../../services/proposalService";
import { siteConfig } from "../../site";

/**
 * "Download PDF": renders the proposal with react-pdf in the browser and
 * saves it as a file. Everything heavy (the renderer, the fonts, the
 * document) loads on first press, so the page itself does not carry it.
 */
export const proposalPdfFilename = (proposal: ProposalRecord): string =>
  `proposal-${proposal.slug}.pdf`;

export const downloadProposalPdf = async (
  proposal: ProposalRecord,
  ownerName: string,
  issued: string
): Promise<void> => {
  const [{ pdf }, { ProposalPdf, formatPdfDate }, { registerProposalFonts }] =
    await Promise.all([
      import("@react-pdf/renderer"),
      import("./ProposalPdf"),
      import("./fonts"),
    ]);
  const [regular, italic, semibold, extrabold] = await Promise.all([
    import("@fontsource/inter/files/inter-latin-400-normal.woff?url"),
    import("@fontsource/inter/files/inter-latin-400-italic.woff?url"),
    import("@fontsource/inter/files/inter-latin-600-normal.woff?url"),
    import("@fontsource/inter/files/inter-latin-800-normal.woff?url"),
  ]);
  registerProposalFonts({
    extrabold: extrabold.default,
    italic: italic.default,
    regular: regular.default,
    semibold: semibold.default,
  });

  const blob = await pdf(
    ProposalPdf({
      domain: siteConfig.domain,
      issued,
      ownerName,
      proposal,
      tagline: siteConfig.tagline,
      validUntil: proposal.doc.validUntil
        ? formatPdfDate(proposal.doc.validUntil)
        : "",
    })
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = proposalPdfFilename(proposal);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
