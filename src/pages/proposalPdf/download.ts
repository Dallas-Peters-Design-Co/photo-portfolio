import type { FontId } from "../../../config/theme";
import type { ProposalRecord } from "../../services/proposalService";
import { siteConfig } from "../../site";

/**
 * Every latin woff of every static @fontsource package installed, as a URL
 * Vite serves, loaded lazily by path. pdfFontFiles names the four the
 * document needs; this is how they reach the renderer in the browser.
 */
const FONT_FILES = import.meta.glob<string>(
  "/node_modules/@fontsource/*/files/*-latin-*.woff",
  { import: "default", query: "?url" }
);

const fontUrl = (file: string): Promise<string> => {
  const load = FONT_FILES[`/node_modules/@fontsource/${file}`];
  if (!load) {
    throw new Error(`Font file not bundled: ${file}`);
  }
  return load();
};

export const proposalPdfFilename = (proposal: ProposalRecord): string =>
  `proposal-${proposal.slug}.pdf`;

export const downloadProposalPdf = async (
  proposal: ProposalRecord,
  ownerName: string,
  issued: string,
  /** The theme's fonts; the PDF is set in them when they have static files. */
  fonts: { display: FontId; sans: FontId } = { display: "inter", sans: "inter" }
): Promise<void> => {
  const [
    { pdf },
    { ProposalPdf, formatPdfDate },
    { pdfFontFiles, pdfFontFor, registerProposalFonts },
  ] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./ProposalPdf"),
    import("./fonts"),
  ]);
  const load = async (id: FontId) => {
    const family = pdfFontFor(id);
    const files = pdfFontFiles(family);
    const [regular, italic, semibold, extrabold] = await Promise.all([
      fontUrl(files.regular),
      fontUrl(files.italic),
      fontUrl(files.semibold),
      fontUrl(files.extrabold),
    ]);
    return { id: family, src: { extrabold, italic, regular, semibold } };
  };
  const [sans, display] = await Promise.all([
    load(fonts.sans),
    load(fonts.display),
  ]);
  registerProposalFonts(sans, display);

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
