import { useMemo, useState } from "react";
import { hexToOklch, oklchToHex, toSrgbGamut } from "../../../lib/oklch";
import type { Lch } from "./SchemeDials";
import {
  buildScheme,
  type Manual,
  SCHEME_DEFAULTS,
  type SchemeOptions,
} from "./scheme";

/**
 * The Palette Builder's state: the anchor, the settings, and what's been
 * done to single colours (locked as they are, or set by hand).
 *
 * "Individual colours" is one switch over everything set by hand. Off, every
 * colour follows the anchor and the settings again; what was set is kept, so
 * switching it back on brings the hand-set colours back as they were.
 */

export type Settings = Omit<SchemeOptions, "anchor" | "locked" | "manual">;

const START = "#2f7cf6";
const turn = (h: number) => ((h % 360) + 360) % 360;

export const lchOf = (hex: string): Lch => {
  const c = hexToOklch(hex) ?? hexToOklch(START);
  return { c: c?.c ?? 0, h: c?.h ?? 0, l: c?.l ?? 0.6 };
};

export const useScheme = (first: string | undefined) => {
  // The anchor as numbers, not a hex read back: a grey remembers its hue.
  const [lch, setLch] = useState<Lch>(() => lchOf(first ?? ""));
  const anchor = useMemo(
    () => oklchToHex(toSrgbGamut({ a: 1, ...lch })),
    [lch]
  );
  const [settings, setSettings] = useState<Settings>(SCHEME_DEFAULTS);
  const [locked, setLocked] = useState<(string | null)[]>([]);
  const [manual, setManual] = useState<(Manual | null)[]>([]);
  const [individual, setIndividual] = useState(true);
  const [picked, setPicked] = useState<number | null>(null);

  const colors = useMemo(
    () =>
      buildScheme({
        ...settings,
        anchor,
        locked,
        manual: individual ? manual : [],
      }),
    [anchor, individual, locked, manual, settings]
  );

  // Where the anchor sits: first, except in a ramp, where it takes the step
  // nearest its own lightness.
  const anchorAt = Math.max(0, colors.indexOf(anchor.toLowerCase()));
  // The colour the dials point at: the anchor unless another is picked (and
  // single colours are on, and it's still there).
  const selected =
    individual && picked !== null && picked < colors.length && !locked[picked]
      ? picked
      : anchorAt;

  /** The selected colour's numbers: what was set by hand over what it is. */
  const selectedLch: Lch =
    selected === anchorAt
      ? lch
      : { ...lchOf(colors[selected] ?? ""), ...(manual[selected] ?? {}) };

  /** Sets some of a colour's lightness, chroma and hue. */
  const setColour = (i: number, next: Manual) => {
    const clean = {
      ...next,
      ...(next.h === undefined ? {} : { h: turn(next.h) }),
    };
    if (i === anchorAt) {
      setLch((was) => ({ ...was, ...clean }));
      return;
    }
    if (!individual) {
      return;
    }
    setManual((was) => {
      const out = [...was];
      out[i] = { ...(out[i] ?? {}), ...clean };
      return out;
    });
  };

  return {
    anchor,
    anchorAt,
    colors,
    /** True when this colour has been set by hand (and that's switched on). */
    held: (i: number) => individual && i !== anchorAt && Boolean(manual[i]),
    individual,
    locked,
    /** Gives a hand-set colour back to the anchor and the settings. */
    release: (i: number) =>
      setManual((was) => was.map((m, k) => (k === i ? null : m))),
    select: setPicked,
    selected,
    selectedLch,
    setAnchor: (hex: string) => setLch(lchOf(hex)),
    setColour,
    setIndividual,
    setSettings: (next: Partial<Settings>) =>
      setSettings((was) => ({ ...was, ...next })),
    settings,
    toggleLock: (i: number) =>
      setLocked((was) => {
        const out = [...was];
        const now = was[i] ?? null;
        out[i] = now === null ? (colors[i] ?? null) : null;
        return out;
      }),
    unlockAll: () => setLocked([]),
  };
};
