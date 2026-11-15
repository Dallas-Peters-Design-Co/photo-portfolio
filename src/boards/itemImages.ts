import type { BoardItem, BoardItemVariation } from "../types";

/** Every usable image in the shapes older board results may have. */
export const pickImages = (
  stored: BoardItem["result"]
): BoardItemVariation[] => {
  const valid = (entries: unknown): BoardItemVariation[] =>
    Array.isArray(entries)
      ? entries.filter(
          (entry): entry is BoardItemVariation =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as Partial<BoardItemVariation>).url === "string" &&
            Boolean((entry as Partial<BoardItemVariation>).url)
        )
      : [];
  const history = valid(stored?.history);
  if (history.length > 0) {
    return history;
  }
  const variations = valid(stored?.variations);
  if (variations.length > 0) {
    return variations;
  }
  return typeof stored?.url === "string" && stored.url
    ? [stored as BoardItemVariation]
    : [];
};
