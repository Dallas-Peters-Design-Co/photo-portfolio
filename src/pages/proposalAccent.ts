import type { CSSProperties } from "react";
import { contrastRatio, isHexColor } from "../../config/theme.js";

/**
 * The proposal's colours, from the site's accent.
 *
 * The accent is used three ways, and each needs its own readable variant:
 *
 * - `--sheet-accent` as a fill (the top rule, the Accept button, the recommended
 *   option's marker);
 * - `--sheet-on-accent`, the ink set on that fill: black or white, whichever reads;
 * - `--sheet-accent-ink`, the accent as text on the paper sheet. A bright accent
 *   such as an olive or a yellow fails as text on white, so it is darkened
 *   toward the ink, step by step, until it reaches 4.5:1.
 *
 * Namespaced to the sheet: `--accent` is already the UI kit's token.
 *
 * Computed here rather than with color-mix() and contrast-color() in CSS:
 * contrast-color() is missing from Firefox and the headless browser that
 * prints the PDF, and only arithmetic can promise the contrast.
 */

const PAPER = "#fbfaf7";
const INK = "#1b1a17";
const FALLBACK = "#7c7f01";
const READABLE = 4.5;
const STEPS = 20;
const HEX_PAIR = /[0-9a-f]{2}/gi;

const channels = (hex: string): number[] =>
  (hex.slice(1).match(HEX_PAIR) ?? []).map((pair) => Number.parseInt(pair, 16));

const toHex = (rgb: number[]): string =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** `a` moved toward `b` by `t` (0 to 1), in plain RGB. */
const mix = (a: string, b: string, t: number): string => {
  const from = channels(a);
  const to = channels(b);
  return toHex(from.map((c, i) => c + ((to[i] ?? c) - c) * t));
};

const onAccent = (accent: string): string =>
  contrastRatio(accent, "#ffffff") >= contrastRatio(accent, INK)
    ? "#ffffff"
    : INK;

export const accentInk = (accent: string): string => {
  for (let step = 0; step <= STEPS; step += 1) {
    const candidate = mix(accent, INK, step / STEPS);
    if (contrastRatio(candidate, PAPER) >= READABLE) {
      return candidate;
    }
  }
  return INK;
};

export const proposalAccentStyle = (accent: string): CSSProperties => {
  const colour = isHexColor(accent) ? accent : FALLBACK;
  return {
    "--sheet-accent": colour,
    "--sheet-accent-ink": accentInk(colour),
    "--sheet-on-accent": onAccent(colour),
  } as CSSProperties;
};
