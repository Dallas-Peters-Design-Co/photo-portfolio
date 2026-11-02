import { normalizeTextStyle } from "../../../config/textStyle";
import type { BoardItem } from "../../types";

/**
 * One change made with several layers selected, applied to each of them.
 *
 * The bars build a change from one layer: its whole text style or drawing
 * settings with the edited value in it. Handed to every layer as is, that
 * would copy the first layer's font, colour and size onto all the others
 * when only one thing was touched. So the change is boiled down to what
 * actually differs from the layer it was built from, and only that is laid
 * over each layer's own settings.
 */

type Bag = Record<string, unknown>;

const isBag = (v: unknown): v is Bag =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The keys whose values differ, with what they became (null if removed). */
const changed = (before: unknown, after: unknown): Bag => {
  const was = isBag(before) ? before : {};
  const now = isBag(after) ? after : {};
  const out: Bag = {};
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (!Object.is(was[key], now[key])) {
      out[key] = now[key] ?? null;
    }
  }
  return out;
};

const toolOf = (item: BoardItem) =>
  isBag(item.config) ? item.config.tool : null;

export const sharedPatch = (
  from: BoardItem,
  patch: Partial<BoardItem>,
  layers: BoardItem[]
): Map<string, Partial<BoardItem>> => {
  const result = new Map<string, Partial<BoardItem>>();
  const textDiff =
    "textStyle" in patch ? changed(from.textStyle, patch.textStyle) : null;
  const configDiff =
    "config" in patch ? changed(from.config, patch.config) : null;
  for (const layer of layers) {
    const next: Partial<BoardItem> = { ...patch };
    if (textDiff) {
      next.textStyle = normalizeTextStyle({
        ...(layer.textStyle ?? {}),
        ...textDiff,
      });
    }
    if (configDiff) {
      // Rounding a rectangle's corners makes it a rounded rectangle; a star
      // selected alongside it stays a star.
      const own =
        "tool" in configDiff && toolOf(layer) !== toolOf(from)
          ? Object.fromEntries(
              Object.entries(configDiff).filter(([key]) => key !== "tool")
            )
          : configDiff;
      next.config = { ...(isBag(layer.config) ? layer.config : {}), ...own };
    }
    result.set(layer.id, next);
  }
  return result;
};
