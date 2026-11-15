import type { CSSProperties } from "react";
import type { PaletteEntry } from "../../../config/brandKit.js";
import { contrastRatio } from "../../../config/theme.js";
import { groupPalette, paperAndInk } from "./guideModel";

const words = (value: string) =>
  value.toLowerCase().replace(/[-_]+/g, " ").trim();

/** Explicit roles win over names and palette-order fallbacks. */
const colourFor = (palette: PaletteEntry[], roles: string[]) => {
  for (const field of ["role", "name"] as const) {
    for (const role of roles) {
      const match = palette.find((entry) => words(entry[field]) === role);
      if (match) {
        return match.value;
      }
    }
  }
};

/** Prefer a readable kit colour; black/white are only for incomplete palettes. */
export const readableOn = (background: string, candidates: string[]) => {
  const ranked = [...new Set(candidates)].sort(
    (a, b) => contrastRatio(background, b) - contrastRatio(background, a)
  );
  const [best] = ranked;
  if (best && contrastRatio(background, best) >= 4.5) {
    return best;
  }
  return contrastRatio(background, "#ffffff") >
    contrastRatio(background, "#000000")
    ? "#ffffff"
    : "#000000";
};

/** Guide-only tokens: never change the site's or canvas's theme. */
export const guideTheme = (palette: PaletteEntry[]): CSSProperties => {
  const colours = palette.map((entry) => entry.value);
  const neutrals = paperAndInk(palette);
  const background =
    colourFor(palette, ["background", "bg", "paper", "surface", "base"]) ??
    neutrals.paper ??
    "#f6f6f3";
  const ink =
    colourFor(palette, ["ink", "text", "foreground", "body text"]) ??
    readableOn(background, colours);
  const accent =
    colourFor(palette, ["accent", "primary", "brand"]) ??
    groupPalette(palette).brand[0]?.value ??
    ink;
  const button =
    colourFor(palette, ["button", "button background", "button fill", "cta"]) ??
    accent;
  return {
    "--guide-accent": accent,
    "--guide-accent-ink":
      contrastRatio(background, accent) >= 4.5 ? accent : ink,
    "--guide-bg": background,
    "--guide-button": button,
    "--guide-button-ink":
      colourFor(palette, [
        "button text",
        "button ink",
        "on primary",
        "on accent",
      ]) ?? readableOn(button, [ink, background, ...colours]),
    "--guide-ink": ink,
    "--guide-muted":
      colourFor(palette, ["muted text", "secondary text"]) ??
      "color-mix(in oklch, var(--guide-ink) 70%, var(--guide-bg))",
    "--guide-rule":
      colourFor(palette, ["border", "line", "rule"]) ??
      "color-mix(in oklch, var(--guide-ink) 18%, var(--guide-bg))",
    "--guide-signal":
      colourFor(palette, ["error", "danger", "negative"]) ?? accent,
    "--guide-surface": colourFor(palette, ["surface", "panel"]) ?? background,
  } as CSSProperties;
};
