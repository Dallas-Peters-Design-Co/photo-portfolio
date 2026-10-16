import { Font } from "@react-pdf/renderer";

/**
 * The PDF sets everything in Inter, which is what the sheet on the web uses.
 * react-pdf reads static font files, so the four cuts the document needs
 * come from the static @fontsource package rather than the variable one the
 * site loads; where they come from (a URL in the browser, a path in Node)
 * is the caller's business.
 */
export interface ProposalFontSources {
  extrabold: string;
  italic: string;
  regular: string;
  semibold: string;
}

export const PROPOSAL_FONT = "Inter";

let registered = false;

export const registerProposalFonts = (src: ProposalFontSources): void => {
  if (registered) {
    return;
  }
  registered = true;
  Font.register({
    family: PROPOSAL_FONT,
    fonts: [
      { fontWeight: 400, src: src.regular },
      { fontStyle: "italic", fontWeight: 400, src: src.italic },
      { fontWeight: 600, src: src.semibold },
      { fontWeight: 800, src: src.extrabold },
    ],
  });
  // No hyphenation: a proposal reads like a contract, and a price or a name
  // split across lines reads like a mistake.
  Font.registerHyphenationCallback((word) => [word]);
};
