/**
 * A brand merge writeup: two brands, and the ways they could become one.
 *
 * It belongs to a review (ReviewDoc.merge) and is read at its own page,
 * /review/:slug/merge, behind the review's password. The two brands are
 * brand kits; the options are the ones Dallas names; the eve agent writes
 * the comparison and each option from the kits and their websites
 * (api/_lib/mergeAgent.ts); the pictures are frames from the review's
 * board, chosen in the editor.
 */

export interface MergeImage {
  height: number;
  url: string;
  width: number;
}

/** One side of the comparison, as the agent read it. */
export interface MergeBrand {
  audience: string;
  name: string;
  /** What the brand is and how it presents itself, in 2-3 sentences. */
  summary: string;
  voice: string;
}

/** One row of the side-by-side: voice, audience, colour… */
export interface MergeAspect {
  a: string;
  aspect: string;
  b: string;
  /** What the difference means for a merge. */
  takeaway: string;
}

export interface MergeOption {
  changes: string[];
  /** How the merged brand would work: name, mark, voice, structure. */
  how: string;
  /** A frame from the board showing this option, if one was chosen. */
  image: MergeImage | null;
  keeps: string[];
  /** As Dallas named it: "RoleModel absorbs Acme", "Endorsed brand"… */
  name: string;
  risks: string[];
  summary: string;
  /** When this is the right choice. */
  when: string;
}

export interface BrandMerge {
  /** The board its pictures come from; the review's own board when null. */
  boardId: string | null;
  /** Brand kits compared, as ids; the agent reads both. */
  brandA: string | null;
  brandB: string | null;
  brands: [MergeBrand, MergeBrand] | null;
  comparison: MergeAspect[];
  /** When the agent last wrote it, ISO; null before it has. */
  generatedAt: string | null;
  hero: MergeImage | null;
  /** Each kit's logo, copied from the kits: the page is public, the kits aren't. */
  logoA: string | null;
  logoB: string | null;
  options: MergeOption[];
  /** One line under the overview: the headline of the whole writeup. */
  outcome: string;
  overview: string;
  recommendation: { option: string; why: string } | null;
  title: string;
}

/** What the editor sets; the rest is the agent's writing. */
type MergeSetupKey =
  | "boardId"
  | "brandA"
  | "brandB"
  | "hero"
  | "logoA"
  | "logoB";

/** The writeup's text, as the agent writes it. */
export type MergeWriteup = Omit<BrandMerge, MergeSetupKey>;

export const MAX_MERGE_OPTIONS = 5;
const MAX_ASPECTS = 12;
const MAX_LIST = 6;
const MAX_LINE = 300;
const MAX_PARA = 2400;
const MAX_URL = 2048;

const KIT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HTTP = /^https?:\/\//i;

export const EMPTY_MERGE: BrandMerge = {
  boardId: null,
  brandA: null,
  brandB: null,
  brands: null,
  comparison: [],
  generatedAt: null,
  hero: null,
  logoA: null,
  logoB: null,
  options: [],
  outcome: "",
  overview: "",
  recommendation: null,
  title: "",
};

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const list = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [])
    .map((item) => str(item, MAX_LINE))
    .filter(Boolean)
    .slice(0, MAX_LIST);

const positive = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;

export const cleanMergeImage = (v: unknown): MergeImage | null => {
  const raw = (v ?? {}) as Partial<MergeImage>;
  const url = str(raw.url, MAX_URL);
  const width = positive(raw.width);
  const height = positive(raw.height);
  return url && HTTP.test(url) && width && height
    ? { height, url, width }
    : null;
};

const kitId = (v: unknown): string | null =>
  typeof v === "string" && KIT_ID.test(v) ? v : null;

const logoUrl = (v: unknown): string | null => {
  const url = str(v, MAX_URL);
  return url && HTTP.test(url) ? url : null;
};

const cleanBrand = (v: unknown): MergeBrand => {
  const raw = (v ?? {}) as Partial<MergeBrand>;
  return {
    audience: str(raw.audience, MAX_LINE),
    name: str(raw.name, 120),
    summary: str(raw.summary, MAX_PARA),
    voice: str(raw.voice, MAX_LINE),
  };
};

const cleanAspect = (v: unknown): MergeAspect => {
  const raw = (v ?? {}) as Partial<MergeAspect>;
  return {
    a: str(raw.a, MAX_LINE),
    aspect: str(raw.aspect, 80),
    b: str(raw.b, MAX_LINE),
    takeaway: str(raw.takeaway, MAX_LINE),
  };
};

export const cleanMergeOption = (v: unknown): MergeOption => {
  const raw = (v ?? {}) as Partial<MergeOption>;
  return {
    changes: list(raw.changes),
    how: str(raw.how, MAX_PARA),
    image: cleanMergeImage(raw.image),
    keeps: list(raw.keeps),
    name: str(raw.name, 120),
    risks: list(raw.risks),
    summary: str(raw.summary, MAX_PARA),
    when: str(raw.when, MAX_LINE),
  };
};

const cleanRecommendation = (v: unknown): BrandMerge["recommendation"] => {
  const raw = (v ?? {}) as { option?: unknown; why?: unknown };
  const option = str(raw.option, 120);
  return option ? { option, why: str(raw.why, MAX_PARA) } : null;
};

/** A writeup from the request or the database, forced into shape; null when there is none. */
export const cleanBrandMerge = (value: unknown): BrandMerge | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Partial<BrandMerge>;
  const brands =
    Array.isArray(raw.brands) && raw.brands.length === 2
      ? ([cleanBrand(raw.brands[0]), cleanBrand(raw.brands[1])] as [
          MergeBrand,
          MergeBrand,
        ])
      : null;
  return {
    // Board ids are uuids too.
    boardId: kitId(raw.boardId),
    brandA: kitId(raw.brandA),
    brandB: kitId(raw.brandB),
    brands,
    comparison: (Array.isArray(raw.comparison) ? raw.comparison : [])
      .map(cleanAspect)
      .filter((row) => row.aspect)
      .slice(0, MAX_ASPECTS),
    generatedAt:
      typeof raw.generatedAt === "string" &&
      !Number.isNaN(Date.parse(raw.generatedAt))
        ? raw.generatedAt
        : null,
    hero: cleanMergeImage(raw.hero),
    logoA: logoUrl(raw.logoA),
    logoB: logoUrl(raw.logoB),
    options: (Array.isArray(raw.options) ? raw.options : [])
      .map(cleanMergeOption)
      .filter((option) => option.name)
      .slice(0, MAX_MERGE_OPTIONS),
    outcome: str(raw.outcome, MAX_LINE),
    overview: str(raw.overview, MAX_PARA),
    recommendation: cleanRecommendation(raw.recommendation),
    title: str(raw.title, 160),
  };
};

/** Whether there is anything to show at the writeup's page. */
export const hasMergeWriteup = (merge: BrandMerge | null): boolean =>
  Boolean(merge?.generatedAt && merge.options.length > 0);
