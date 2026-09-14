import { FAL_PARAM_SUPPORT } from "./falParams.generated.js";

/**
 * How long a clip should be, in the words the chosen endpoint actually uses.
 *
 * The Video node offered "5" and "10" to every model. The endpoints do not
 * agree and fal validates strictly, so a Veo generation was submitted, billed,
 * and then refused with `Input should be '4s', '6s' or '8s'` — a message that
 * arrives after the money is gone and names a vocabulary the node had no way of
 * knowing about.
 *
 * The real sets, read from fal's own OpenAPI by scripts/fetch-fal-params.py:
 *
 *   Veo 3.1 (all three tiers)   "4s", "6s", "8s"
 *   Kling v2.5 Turbo Pro        "5", "10"
 *   Kling v3                    "3" … "15"
 *   Seedance 2.5                "4" … "30", "auto"
 *   Wan, PixVerse, MiniMax…     no enum — any value
 *
 * Shared by the picker and the run path on purpose. The control offering one
 * vocabulary while the request sends another is the same bug wearing a
 * different hat.
 */

const LEADING_DIGITS = /^(\d+)/;

/** Seconds as a number, or null for a value that is not one ("auto"). */
const secondsOf = (value: string): number | null => {
  const digits = LEADING_DIGITS.exec(value.trim());
  return digits ? Number(digits[1]) : null;
};

/**
 * The values this endpoint accepts, longest-first-free and in human order.
 *
 * Null means the endpoint declares no `duration` at all — background removal
 * and upscaling take a clip and nothing else — and the field must then be left
 * out of the body entirely rather than sent empty.
 *
 * An empty list means it takes a duration but constrains it to nothing, so
 * whatever the node says is passed through untouched.
 */
export const durationOptionsFor = (model: string): readonly string[] | null => {
  const allowed = FAL_PARAM_SUPPORT[model]?.duration;
  if (!allowed) {
    return null;
  }
  // Sorted as numbers, not as text. The generated table is sorted as strings,
  // which puts "10" before "4" and makes the menu read as nonsense. Anything
  // without a number ("auto") goes last.
  return [...allowed].sort((a, b) => {
    const left = secondsOf(a);
    const right = secondsOf(b);
    if (left === null || right === null) {
      if (left === right) {
        return 0;
      }
      return left === null ? 1 : -1;
    }
    return left - right;
  });
};

/**
 * What to actually send for a node set to `wanted` seconds.
 *
 * Null means send nothing. Otherwise the endpoint's own spelling: the exact
 * value when it is offered, the same number spelled its way ("5" → "5s") when
 * it is not, and failing both the nearest length it does offer.
 *
 * Ties go to the shorter clip. Every one of these endpoints bills by duration,
 * so a request for five seconds answered with eight would quietly charge more
 * than was asked for — and nobody reads a silent upgrade as a kindness.
 */
export const durationFor = (model: string, wanted: string): string | null => {
  const allowed = durationOptionsFor(model);
  if (allowed === null) {
    return null;
  }
  const asked = wanted.trim();
  if (allowed.length === 0 || allowed.includes(asked)) {
    return asked || null;
  }

  const seconds = secondsOf(asked);
  if (seconds === null) {
    return null;
  }
  // Same number, their spelling — "5" against a list of "4s"/"6s"/"8s" is a
  // formatting difference, not a different length.
  const sameLength = allowed.find((value) => secondsOf(value) === seconds);
  if (sameLength) {
    return sameLength;
  }

  const numeric = allowed.filter((value) => secondsOf(value) !== null);
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
