import { Font } from "@react-pdf/renderer";
import type { FontId } from "../../../config/theme";

/**
 * The PDF is set in the site theme's sans, like the sheet on the web.
 *
 * react-pdf reads static font files and cannot pick a weight out of a
 * variable font, so each family the theme can choose needs a static
 * @fontsource package with the four cuts the document uses (regular,
 * italic, semibold, extrabold). Families that only ship as variable fonts
 * fall back to Inter in the PDF; adding a static package and a line in
 * PDF_FONT_FILES below is what brings one in. Where the files come from (a
 * URL in the browser, a path in Node) is the caller's business.
 */
export interface ProposalFontSources {
  extrabold: string;
  italic: string;
  regular: string;
  semibold: string;
}

/** The react-pdf family names every style refers to: body, and titles. */
export const PROPOSAL_FONT = "ProposalSans";
export const PROPOSAL_DISPLAY_FONT = "ProposalDisplay";

export const FALLBACK_PDF_FONT: FontId = "inter";

/** Static @fontsource packages, with the family's file prefix. */
export const PDF_FONT_FILES: Partial<Record<FontId, string>> = {
  "barlow-semi-condensed": "barlow-semi-condensed",
  figtree: "figtree",
  inter: "inter",
  mulish: "mulish",
};

/** The theme font the PDF will use, or the fallback when it has no files. */
export const pdfFontFor = (id: FontId): FontId =>
  PDF_FONT_FILES[id] ? id : FALLBACK_PDF_FONT;

/** The four files, as "<package>/files/<name>.woff" paths inside @fontsource. */
export const pdfFontFiles = (
  id: FontId
): Record<keyof ProposalFontSources, string> => {
  const chosen = pdfFontFor(id);
  const prefix = PDF_FONT_FILES[chosen] ?? FALLBACK_PDF_FONT;
  return {
    extrabold: `${prefix}/files/${prefix}-latin-800-normal.woff`,
    italic: `${prefix}/files/${prefix}-latin-400-italic.woff`,
    regular: `${prefix}/files/${prefix}-latin-400-normal.woff`,
    semibold: `${prefix}/files/${prefix}-latin-600-normal.woff`,
  };
};

const registered = new Map<string, FontId>();

const registerFamily = (
  family: string,
  id: FontId,
  src: ProposalFontSources
): void => {
  if (registered.get(family) === id) {
    return;
  }
  registered.set(family, id);
  Font.register({
    family,
    fonts: [
      { fontWeight: 400, src: src.regular },
      { fontStyle: "italic", fontWeight: 400, src: src.italic },
      { fontWeight: 600, src: src.semibold },
      { fontWeight: 800, src: src.extrabold },
    ],
  });
};

/** Body in the sans, titles in the display font (the sans when not given). */
export const registerProposalFonts = (
  sans: { id: FontId; src: ProposalFontSources },
  display: { id: FontId; src: ProposalFontSources } = sans
): void => {
  registerFamily(PROPOSAL_FONT, sans.id, sans.src);
  registerFamily(PROPOSAL_DISPLAY_FONT, display.id, display.src);
  // No hyphenation: a proposal reads like a contract, and a price or a name
  // split across lines reads like a mistake.
  Font.registerHyphenationCallback((word) => [word]);
};
