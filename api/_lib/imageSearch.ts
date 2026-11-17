import { getDb, schema } from "./orm.js";

/**
 * Searching the library and collections by colour and mood.
 *
 * A query is words and colours: "#041045", "navy", "warm amber poster",
 * "moody interior". Colours are hex codes or colour words; the rest are
 * words, matched against each image's description (imageDescribe.ts), title
 * and alt text. An image scores for each word it has and for how close its
 * colours come to each colour asked for; the best come first.
 *
 * Scored in memory: a library is hundreds or a few thousand images, and the
 * colour distance is easier to get right here than in SQL.
 */

export interface ImageHit {
  colors: string[];
  description: string | null;
  height: number | null;
  id: string;
  /** A photo in the library, or an item in a collection. */
  source: "collection" | "photo";
  title: string | null;
  url: string;
  width: number | null;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const WORD = /[a-z0-9#]+/gi;
const DIGIT = /\d/;
const MAX_HITS = 60;
/** Two colours this close (out of ~442) count as the same. */
const NEAR = 60;
const FAR = 160;

/** Colour words people search with, as a representative colour. */
const COLOUR_WORDS: Record<string, string> = {
  amber: "#ffbf00",
  beige: "#e8dcc4",
  black: "#111111",
  blue: "#2f6fdb",
  brown: "#7a4b2a",
  coral: "#ff7f50",
  cream: "#f5efe0",
  gold: "#d4a017",
  gray: "#8a8a8a",
  green: "#2e9d4a",
  grey: "#8a8a8a",
  lavender: "#b9a7e0",
  mint: "#9fe2bf",
  navy: "#0b1f4b",
  olive: "#6b6e2e",
  orange: "#f2862e",
  pink: "#f29bb7",
  purple: "#7a3fb0",
  red: "#d63a2f",
  rust: "#b7410e",
  sage: "#a3b18a",
  teal: "#1f8a8a",
  terracotta: "#c8643c",
  white: "#f7f7f5",
  yellow: "#f5d33a",
};

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
};

/** Distance between two colours, weighted toward how the eye sees them. */
const distance = (a: string, b: string): number => {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const r = (r1 + r2) / 2;
  return (
    Math.sqrt(
      (2 + r / 256) * (r1 - r2) ** 2 +
        4 * (g1 - g2) ** 2 +
        (2 + (255 - r) / 256) * (b1 - b2) ** 2
    ) / 3
  );
};

/** The query as the colours it names and the words it asks for. */
export const parseQuery = (
  q: string
): { colours: string[]; words: string[] } => {
  const colours: string[] = [];
  const words: string[] = [];
  for (const token of q.toLowerCase().match(WORD) ?? []) {
    if (HEX.test(token) && (token.startsWith("#") || DIGIT.test(token))) {
      colours.push(token.startsWith("#") ? token : `#${token}`);
    } else if (COLOUR_WORDS[token]) {
      colours.push(COLOUR_WORDS[token] as string);
      // The word itself also counts: "navy blazer" is in the description.
      words.push(token);
    } else if (token.length > 1) {
      words.push(token);
    }
  }
  return { colours, words };
};

/** How well one image answers the query; 0 is not at all. */
export const scoreImage = (
  image: Pick<ImageHit, "colors" | "description" | "title"> & {
    alt?: string | null;
  },
  query: { colours: string[]; words: string[] }
): number => {
  const text = [image.description, image.title, image.alt]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let score = 0;
  for (const word of query.words) {
    if (text.includes(word)) {
      score += 2;
    }
  }
  for (const colour of query.colours) {
    // The closest of the image's colours, earlier ones (more prominent)
    // counting a little more.
    const best = Math.max(
      0,
      ...image.colors.map((c, i) => {
        const d = distance(colour, c);
        const close = d <= NEAR ? 1 : Math.max(0, (FAR - d) / (FAR - NEAR));
        return close * (1 - i * 0.08);
      })
    );
    score += best * 3;
  }
  return score;
};

export const searchImages = async (q: string): Promise<ImageHit[]> => {
  const query = parseQuery(q);
  if (query.words.length === 0 && query.colours.length === 0) {
    return [];
  }
  const db = getDb();
  const [items, photos] = await Promise.all([
    db
      .select({
        alt: schema.collectionItems.alt,
        colors: schema.collectionItems.colors,
        description: schema.collectionItems.aiDescription,
        height: schema.collectionItems.height,
        id: schema.collectionItems.id,
        kind: schema.collectionItems.kind,
        title: schema.collectionItems.title,
        url: schema.collectionItems.url,
        width: schema.collectionItems.width,
      })
      .from(schema.collectionItems),
    db
      .select({
        alt: schema.photos.alt,
        colors: schema.photos.colors,
        description: schema.photos.aiDescription,
        height: schema.photos.height,
        id: schema.photos.id,
        title: schema.photos.title,
        url: schema.photos.url,
        width: schema.photos.width,
      })
      .from(schema.photos),
  ]);
  const all = [
    ...items
      .filter((r) => r.kind !== "video")
      .map((r) => ({ ...r, source: "collection" as const })),
    ...photos.map((r) => ({ ...r, source: "photo" as const })),
  ];
  // The same picture saved twice shows once.
  const seen = new Set<string>();
  return all
    .map((r) => ({
      hit: {
        colors: r.colors ?? [],
        description: r.description || null,
        height: r.height,
        id: r.id,
        source: r.source,
        title: r.title,
        url: r.url,
        width: r.width,
      } satisfies ImageHit,
      score: scoreImage({ ...r, colors: r.colors ?? [] }, query),
    }))
    .filter(({ hit, score }) => {
      if (score <= 0 || seen.has(hit.url)) {
        return false;
      }
      seen.add(hit.url);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_HITS)
    .map(({ hit }) => hit);
};
