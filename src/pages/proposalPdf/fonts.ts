import { Font } from "@react-pdf/renderer";
import { type FontId, findFont } from "../../../config/theme";

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

/**
 * Variable families that also have a static @fontsource package installed,
 * with that package's cuts. Static families carry their own cuts on their
 * theme entry; everything else falls back to Inter in the PDF.
 */
const STATIC_TWINS: Partial<
  Record<FontId, { cuts: number[]; italic: boolean }>
> = {
  figtree: { cuts: [300, 400, 500, 600, 700, 800, 900], italic: true },
  inter: { cuts: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true },
  mulish: { cuts: [200, 300, 400, 500, 600, 700, 800, 900], italic: true },
};

const staticCuts = (id: FontId): { cuts: number[]; italic: boolean } | null => {
  const font = findFont(id);
  if (font?.cuts) {
    return { cuts: font.cuts, italic: font.italic };
  }
  return STATIC_TWINS[id] ?? null;
};

/** The theme font the PDF will use, or the fallback when it has no files. */
export const pdfFontFor = (id: FontId): FontId =>
  staticCuts(id) ? id : FALLBACK_PDF_FONT;

/** The closest weight the family ships to the one asked for. */
export const nearestCut = (cuts: number[], wanted: number): number =>
  cuts.reduce(
    (best, c) => (Math.abs(c - wanted) < Math.abs(best - wanted) ? c : best),
    cuts[0] ?? wanted
  );

/**
 * The four files, as "<package>/files/<name>.woff" paths inside @fontsource.
 * A family short of a weight gets its nearest; one without an italic gets
 * the regular, so a doc with an italic word never fails to render.
 */
export const pdfFontFiles = (
  id: FontId
): Record<keyof ProposalFontSources, string> => {
  const chosen = pdfFontFor(id);
  const { cuts, italic } = staticCuts(chosen) ??
    STATIC_TWINS.inter ?? { cuts: [400], italic: false };
  const file = (weight: number, style: "normal" | "italic") =>
    `${chosen}/files/${chosen}-latin-${weight}-${style}.woff`;
  const regular = nearestCut(cuts, 400);
  return {
    extrabold: file(nearestCut(cuts, 800), "normal"),
    italic: italic ? file(regular, "italic") : file(regular, "normal"),
    regular: file(regular, "normal"),
    semibold: file(nearestCut(cuts, 600), "normal"),
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
