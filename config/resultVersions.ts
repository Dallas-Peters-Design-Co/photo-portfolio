interface ImageVersion {
  url?: string;
}

interface ImageHistory {
  history?: ImageVersion[];
  url?: string;
  variations?: (ImageVersion | null)[];
}

const isVersion = (value: unknown): value is ImageVersion =>
  typeof value === "object" &&
  value !== null &&
  "url" in value &&
  typeof value.url === "string" &&
  Boolean(value.url);

/** History is authoritative, including an intentionally empty history. */
export const resultVersions = (result: ImageHistory | null): ImageVersion[] => {
  if (Array.isArray(result?.history)) {
    return result.history.filter(isVersion);
  }
  if (Array.isArray(result?.variations)) {
    return result.variations.filter(isVersion);
  }
  return result?.url ? [result] : [];
};

/** Address a version by URL: indexes shift when two removals overlap. */
export const withoutResultVersion = <T extends ImageHistory>(
  result: T | null,
  url: string
): T | null => {
  if (!result) {
    return null;
  }
  const history = resultVersions(result);
  const kept = history.filter((image) => image.url !== url);
  if (kept.length === history.length) {
    return result;
  }
  if (kept.length === 0) {
    return null;
  }
  return { ...result, history: kept, url: kept[0]?.url ?? "", variations: [] };
};
