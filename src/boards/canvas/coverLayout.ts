/**
 * Where a cover's words go, as arithmetic.
 *
 * Pure, and free of the DOM on purpose: this is the half of the Cover node that
 * can be tested without a GPU, a font or a browser, and it is the half that is
 * load-bearing. A shader bug is visible in the first frame; a layout bug ships
 * on six books.
 *
 * It returns runs — a string with a face, a size and a baseline — and knows
 * nothing about how they are drawn. renderCoverNode paints them with canvas2d;
 * anything else could paint them some other way from the same numbers.
 *
 * Measurement is injected. Fitting a title to a column needs a measurer and a
 * measurer needs a canvas, so the caller passes one in and a test passes a fake.
 * The alternative is a layout module that cannot be imported without a browser.
 */

export const COVER_WIDTH = 1800;
export const COVER_HEIGHT = 2700;

/** Width of `text` set at 1px in `face`. Scaled linearly by the caller. */
export type Measure = (text: string, face: string) => number;

export type CoverVariant = "poster" | "horizon";

export interface CoverWords {
  author: string;
  subtitle: string;
  title: string;
}

export interface CoverColors {
  /** Subtitle, on Poster only — Horizon sets it in the type colour at 85%. */
  accent: string;
  band: string;
  ink: string;
}

export interface Run {
  align: "left" | "center" | "right";
  /** Distance from the top of the trim to the baseline. */
  baseline: number;
  face: string;
  fill: string;
  /** 0–1, for the Horizon subtitle which sits back from the title. */
  opacity: number;
  role: "title" | "subtitle" | "author";
  size: number;
  text: string;
  /** Letter-spacing in px at the fitted size, not at 1em. */
  tracking: number;
  width: number;
  x: number;
}

export interface Band {
  height: number;
  fill: string;
}

/** A filled rectangle under the byline, in the band colour. Poster only. */
export interface Plate {
  fill: string;
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface CoverLayout {
  /** Absent on Horizon, which sets its type straight over the artwork. */
  band: Band | null;
  height: number;
  /** Absent on Horizon, and on Poster when there is no byline to sit on it. */
  plate: Plate | null;
  runs: readonly Run[];
  width: number;
}

/*
 * The faces, as Adobe Fonts names them.
 *
 * Vinyl for titles and Rift for the byline — the two the Unruly Chain covers
 * are already set in. These are the CSS family names from the Typekit kit, not
 * PostScript names: canvas2d resolves a font the way CSS does.
 */
export const TITLE_FACE = '"vinyl", "Archivo Narrow", sans-serif';
export const AUTHOR_FACE = '"rift", "Archivo Narrow", sans-serif';

const MARGIN = 48;
const LIVE = COVER_WIDTH - MARGIN * 2;

/**
 * The size that fills `width`, capped.
 *
 * Measured at 1px and scaled, which is exact for any face not doing optical
 * sizing and close enough for one that is — the cap decides the answer in every
 * case anybody notices. Tracking adds (n−1) gaps, and at display sizes that is
 * not a rounding error: a title tracked at +120 overflowed its column by most
 * of a glyph before this accounted for it.
 */
const fitted = (
  text: string,
  face: string,
  width: number,
  measure: Measure,
  max: number,
  tracking: number
): number => {
  const unit = measure(text, face);
  if (unit <= 0) {
    return max;
  }
  const gaps = Math.max(0, text.length - 1);
  return Math.max(1, Math.min(max, (width - gaps * tracking) / unit));
};

/*
 * Poster, as the Centrifuge artboard in BookCovers.psd has it (Sept 2026):
 * the title runs the full width of the trim, nearly bleed to bleed, on a
 * band that stops at 482; the subtitle is centred under it and overlaps the
 * top of the artwork; the byline sits right-aligned on a plate in the band
 * colour at the lower right. Measured off the PSD rather than guessed, so
 * the node's cover and the designer's line up.
 */
const POSTER = {
  authorBaseline: 2547,
  authorRight: 1628,
  authorSize: 128,
  bandHeight: 482,
  plate: { height: 167, width: 672, x: 1043, y: 2418 },
  subtitleBaseline: 572,
  subtitleMax: 66,
  titleBaseline: 450,
  titleMargin: 20,
  titleMax: 560,
} as const;

const HORIZON = {
  authorBaseline: 2496,
  authorSize: 62,
  subtitleBaseline: 430,
  subtitleMax: 54,
  titleBaseline: 310,
  titleMax: 210,
  titleTracking: 14,
} as const;

/**
 * The words, placed.
 *
 * Always at 1800×2700 whatever it will be drawn into, and a preview scales the
 * whole result by one factor. A layout computed at 600px wide and one computed
 * at 1800 disagree about where a fitted title breaks, and the one the designer
 * approved would be the one that never shipped.
 */
export const coverLayout = (
  variant: CoverVariant,
  words: CoverWords,
  colors: CoverColors,
  measure: Measure
): CoverLayout => {
  const title = words.title.trim().toLocaleUpperCase();
  const subtitle = words.subtitle.trim();
  const author = words.author.trim().toLocaleUpperCase();
  const runs: Run[] = [];

  const horizon = variant === "horizon";
  const M = horizon ? HORIZON : POSTER;
  const tracking = horizon ? HORIZON.titleTracking : 0;

  if (title) {
    // Poster's title is set wider than the live area on purpose: it is the
    // one thing on the cover allowed to touch the edges, and in the PSD it
    // does. Horizon keeps the ordinary margin.
    const titleX = horizon ? MARGIN : POSTER.titleMargin;
    const titleWidth = COVER_WIDTH - titleX * 2;
    runs.push({
      align: horizon ? "center" : "left",
      baseline: M.titleBaseline,
      face: TITLE_FACE,
      fill: colors.ink,
      opacity: 1,
      role: "title",
      size: fitted(title, TITLE_FACE, titleWidth, measure, M.titleMax, tracking),
      text: title,
      tracking,
      width: titleWidth,
      x: titleX,
    });
  }

  if (subtitle) {
    runs.push({
      align: "center",
      baseline: M.subtitleBaseline,
      face: TITLE_FACE,
      // Poster puts the subtitle in the accent on a solid band, which is where
      // a warm colour reads. Horizon sets it over artwork, where the accent
      // would fight whatever is behind it, so it stays in the type colour and
      // steps back on opacity instead.
      fill: horizon ? colors.ink : colors.accent,
      opacity: horizon ? 0.85 : 1,
      role: "subtitle",
      size: fitted(subtitle, TITLE_FACE, LIVE, measure, M.subtitleMax, 0),
      text: subtitle,
      tracking: 0,
      width: LIVE,
      x: MARGIN,
    });
  }

  if (author) {
    runs.push(
      horizon
        ? {
            align: "center",
            baseline: M.authorBaseline,
            face: AUTHOR_FACE,
            fill: colors.ink,
            opacity: 1,
            role: "author",
            size: M.authorSize,
            text: author,
            tracking: 8,
            width: LIVE,
            x: MARGIN,
          }
        : {
            // Right-aligned inside the plate: `x` is the plate's left edge
            // and `width` reaches the text's right edge, so a longer name
            // grows leftward across the plate.
            align: "right",
            baseline: POSTER.authorBaseline,
            face: AUTHOR_FACE,
            fill: colors.ink,
            opacity: 1,
            role: "author",
            size: POSTER.authorSize,
            text: author,
            tracking: 0,
            width: POSTER.authorRight - POSTER.plate.x,
            x: POSTER.plate.x,
          }
    );
  }

  return {
    band: horizon ? null : { fill: colors.band, height: POSTER.bandHeight },
    height: COVER_HEIGHT,
    plate: horizon || !author ? null : { fill: colors.band, ...POSTER.plate },
    runs,
    width: COVER_WIDTH,
  };
};

/**
 * Title, subtitle and author out of a wired Words node.
 *
 * JSON when it parses to an object, otherwise up to three plain lines in that
 * order — a Note with three lines in it is the shape somebody actually types,
 * and refusing it because it is not JSON would be pedantry.
 */
export const wordsFromText = (value: string | null): Partial<CoverWords> => {
  const raw = (value ?? "").trim();
  if (!raw) {
    return {};
  }
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const pick = (key: string) =>
        typeof parsed[key] === "string" ? (parsed[key] as string) : undefined;
      return {
        ...(pick("author") === undefined ? {} : { author: pick("author") }),
        ...(pick("subtitle") === undefined
          ? {}
          : { subtitle: pick("subtitle") }),
        ...(pick("title") === undefined ? {} : { title: pick("title") }),
      };
    } catch {
      // Not JSON after all. Fall through and read it as lines, which is more
      // useful than refusing a note that merely starts with a brace.
    }
  }
  const [title, subtitle, author] = raw.split(/\r?\n/).map((l) => l.trim());
  return {
    ...(author ? { author } : {}),
    ...(subtitle ? { subtitle } : {}),
    ...(title ? { title } : {}),
  };
};
