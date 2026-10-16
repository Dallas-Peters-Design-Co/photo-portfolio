import type { FontId } from "../../../config/theme";
import type { ProposalRecord } from "../../services/proposalService";
import { siteConfig } from "../../site";

/**
 * The woff files Vite can serve, one import per cut per family. Static
 * strings because Vite resolves `?url` imports at build time; a template
 * literal would leave the file out of the bundle.
 */
const FONT_URLS: Record<
  string,
  Record<
    "extrabold" | "italic" | "regular" | "semibold",
    () => Promise<{ default: string }>
  >
> = {
  "barlow-semi-condensed": {
    extrabold: () =>
      import(
        "@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-800-normal.woff?url"
      ),
    italic: () =>
      import(
        "@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-400-italic.woff?url"
      ),
    regular: () =>
      import(
        "@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-400-normal.woff?url"
      ),
    semibold: () =>
      import(
        "@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-600-normal.woff?url"
      ),
  },
  figtree: {
    extrabold: () =>
      import("@fontsource/figtree/files/figtree-latin-800-normal.woff?url"),
    italic: () =>
      import("@fontsource/figtree/files/figtree-latin-400-italic.woff?url"),
    regular: () =>
      import("@fontsource/figtree/files/figtree-latin-400-normal.woff?url"),
    semibold: () =>
      import("@fontsource/figtree/files/figtree-latin-600-normal.woff?url"),
  },
  inter: {
    extrabold: () =>
      import("@fontsource/inter/files/inter-latin-800-normal.woff?url"),
    italic: () =>
      import("@fontsource/inter/files/inter-latin-400-italic.woff?url"),
    regular: () =>
      import("@fontsource/inter/files/inter-latin-400-normal.woff?url"),
    semibold: () =>
      import("@fontsource/inter/files/inter-latin-600-normal.woff?url"),
  },
  mulish: {
    extrabold: () =>
      import("@fontsource/mulish/files/mulish-latin-800-normal.woff?url"),
    italic: () =>
      import("@fontsource/mulish/files/mulish-latin-400-italic.woff?url"),
    regular: () =>
      import("@fontsource/mulish/files/mulish-latin-400-normal.woff?url"),
    semibold: () =>
      import("@fontsource/mulish/files/mulish-latin-600-normal.woff?url"),
  },
};

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
  issued: string,
  /** The theme's fonts; the PDF is set in them when they have static files. */
  fonts: { display: FontId; sans: FontId } = { display: "inter", sans: "inter" }
): Promise<void> => {
  const [
    { pdf },
    { ProposalPdf, formatPdfDate },
    { pdfFontFor, registerProposalFonts },
  ] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./ProposalPdf"),
    import("./fonts"),
  ]);
  const load = async (id: FontId) => {
    const family = pdfFontFor(id);
    const urls = FONT_URLS[family] ?? FONT_URLS.inter;
    const [regular, italic, semibold, extrabold] = await Promise.all([
      urls.regular(),
      urls.italic(),
      urls.semibold(),
      urls.extrabold(),
    ]);
    return {
      id: family,
      src: {
        extrabold: extrabold.default,
        italic: italic.default,
        regular: regular.default,
        semibold: semibold.default,
      },
    };
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
