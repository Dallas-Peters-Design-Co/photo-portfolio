import { FAL_DURATION } from "./falParams.generated.js";

/**
 * How long a clip should be, in the words — and the type — the chosen endpoint
 * actually uses.
 *
 * The Video node offered "5" and "10" seconds to every model. The endpoints do
 * not agree, and fal validates after it bills, so the disagreement surfaced as
 * `Could not collect the video (Input should be '4s', '6s' or '8s')` — a
 * message that arrives once the generation is already paid for.
 *
 * There are two ways to get it wrong and they fail identically:
 *
 *   the wrong value — Veo lists "4s", "6s", "8s" and refuses "5"
 *   the wrong type  — Wan, MiniMax, PixVerse and Happy Horse declare a plain
 *                     integer and refuse "5" for being a string
 *
 * So the table read from fal's OpenAPI records both; see FAL_DURATION in
 * falParams.generated.ts, written by scripts/fetch-fal-params.py.
 *
 * The picker and the run path share this on purpose. A control offering one
 * vocabulary while the request sends another is the same bug wearing a hat.
 */

const LEADING_DIGITS = /^(\d+)/;

/** Seconds as a number, or null for a value that is not one ("auto"). */
const secondsOf = (value: string): number | null => {
  const digits = LEADING_DIGITS.exec(value.trim());
  return digits ? Number(digits[1]) : null;
};

/** Shortest first; anything without a number ("auto") last. */
const byLength = (a: string, b: string): number => {
  const left = secondsOf(a);
  const right = secondsOf(b);
  if (left === null || right === null) {
    if (left === right) {
      return 0;
    }
    return left === null ? 1 : -1;
  }
  return left - right;
};

/**
 * The lengths this endpoint offers, or null when it takes no duration at all.
 *
 * Background removal and upscaling take a clip and nothing else, and an empty
 * `duration` sent to a schema that declares no such field is a 422 — so null
 * has to mean "send nothing", not "send whatever".
 *
 * An endpoint that constrains by range rather than by list (MiniMax 5-15,
 * PixVerse 1-15) has its range written out, because a menu is what the node
 * shows and a range is not one.
 */
export const durationOptionsFor = (model: string): readonly string[] | null => {
  const spec = FAL_DURATION[model];
  if (!spec) {
    return null;
  }
  if (spec.values.length > 0) {
    return [...spec.values].sort(byLength);
  }
  const min = spec.min ?? 1;
  const max = spec.max ?? min;
  return Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
};

/**
 * What to actually send for a node asking for `wanted` seconds.
 *
 * Null means send nothing. Otherwise the endpoint's own spelling *and* its own
 * type: a number where it declares an integer, its exact string where it lists
 * one, and the same length spelled its way ("5" → "5s") where the two differ
 * only in formatting.
 *
 * A length it does not offer falls to the nearest it does, ties going to the
 * shorter clip. Every one of these endpoints bills by duration, so answering a
 * request for five seconds with eight would quietly charge for footage nobody
 * asked for.
 */
export const durationValueFor = (
  model: string,
  wanted: string
): string | number | null => {
  const spec = FAL_DURATION[model];
  const options = durationOptionsFor(model);
  if (!(spec && options)) {
    return null;
  }

  const asked = wanted.trim();
  if (!asked) {
    return null;
  }
  const chosen = options.includes(asked) ? asked : nearest(options, asked);
  if (chosen === null) {
    return null;
  }
  // "auto" is a word Seedance accepts, not a length — it survives only on the
  // endpoints that list it, and those declare their duration as a string.
  if (spec.kind === "integer") {
    const seconds = secondsOf(chosen);
    return seconds === null ? null : seconds;
  }
  return chosen;
};

/** The offered length closest to the one asked for, ties going shorter. */
const nearest = (options: readonly string[], asked: string): string | null => {
  const seconds = secondsOf(asked);
  if (seconds === null) {
    return null;
  }
  // Same number, their spelling — "5" against "4s"/"6s"/"8s" is a formatting
  // difference; "8" against them is not.
  const sameLength = options.find((value) => secondsOf(value) === seconds);
  if (sameLength) {
    return sameLength;
  }
  const numeric = options.filter((value) => secondsOf(value) !== null);
  if (numeric.length === 0) {
    return null;
  }
  return numeric.reduce((best, value) => {
    const gap = Math.abs((secondsOf(value) as number) - seconds);
    const bestGap = Math.abs((secondsOf(best) as number) - seconds);
    if (gap !== bestGap) {
      return gap < bestGap ? value : best;
    }
    return (secondsOf(value) as number) < (secondsOf(best) as number)
      ? value
      : best;
  });
};

/** The menu's own label for a stored value: what the run would send, as text. */
export const durationLabelFor = (
  model: string,
  wanted: string
): string | null => {
  const value = durationValueFor(model, wanted);
  return value === null ? null : String(value);
};
