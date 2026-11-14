import { useEffect, useMemo, useState } from "react";
import type { PaletteEntry } from "../../../../config/brandKit.js";
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
/** As many brand colours as the builder takes in. */
export const MAX_LOADED = 16;
const turn = (h: number) => ((h % 360) + 360) % 360;

export const lchOf = (hex: string): Lch => {
  const c = hexToOklch(hex) ?? hexToOklch(START);
  return { c: c?.c ?? 0, h: c?.h ?? 0, l: c?.l ?? 0.6 };
};

/** What's kept between visits: everything the palette is made from. */
interface Saved {
  /** The brand colours it was loaded from, by position: their names and roles. */
  base: PaletteEntry[] | null;
  individual: boolean;
  lch: Lch;
  locked: (string | null)[];
  manual: (Manual | null)[];
  settings: Settings;
}

const readSaved = (key: string): Partial<Saved> => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null") as unknown;
    return raw && typeof raw === "object" ? (raw as Partial<Saved>) : {};
  } catch {
    return {};
  }
};

const isLch = (v: unknown): v is Lch =>
  typeof v === "object" &&
  v !== null &&
  ["c", "h", "l"].every(
    (k) => typeof (v as Record<string, unknown>)[k] === "number"
  );

/**
 * @param first       the colour a new palette starts from (the brand's first)
 * @param storageKey  where this palette is kept in the browser, so leaving
 *                    the tool (or closing the Studio) and coming back finds
 *                    it as it was; one per brand kit
 */
export const useScheme = (first: string | undefined, storageKey: string) => {
  const [saved] = useState(() => readSaved(storageKey));
  // The anchor as numbers, not a hex read back: a grey remembers its hue.
  const [lch, setLch] = useState<Lch>(() =>
    isLch(saved.lch) ? saved.lch : lchOf(first ?? "")
  );
  const anchor = useMemo(
    () => oklchToHex(toSrgbGamut({ a: 1, ...lch })),
    [lch]
  );
  const [settings, setSettings] = useState<Settings>({
    ...SCHEME_DEFAULTS,
    ...(saved.settings ?? {}),
  });
  const [locked, setLocked] = useState<(string | null)[]>(
    Array.isArray(saved.locked) ? saved.locked : []
  );
  const [manual, setManual] = useState<(Manual | null)[]>(
    Array.isArray(saved.manual) ? saved.manual : []
  );
  const [individual, setIndividual] = useState(saved.individual !== false);
  const [base, setBase] = useState<PaletteEntry[] | null>(
    Array.isArray(saved.base) ? saved.base : null
  );
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const keep: Saved = { base, individual, lch, locked, manual, settings };
    try {
      localStorage.setItem(storageKey, JSON.stringify(keep));
    } catch {
      // Remembering is a convenience.
    }
  }, [base, individual, lch, locked, manual, settings, storageKey]);

  /**
   * The brand's own palette, loaded to be edited: its first colour is the
   * anchor and every other one is set by hand to exactly what it is, so
   * nothing changes until something is changed. Names and roles are kept by
   * position, for saving back.
   */
  const loadBrand = (entries: PaletteEntry[]) => {
    const [head, ...rest] = entries.slice(0, MAX_LOADED);
    if (!head) {
      return;
    }
    setLch(lchOf(head.value));
    setManual([null, ...rest.map((e) => lchOf(e.value))]);
    setLocked([]);
    setIndividual(true);
    setPicked(null);
    setBase(entries.slice(0, MAX_LOADED));
    setSettings((was) => ({
      ...was,
      count: Math.max(2, rest.length + 1),
      matchChroma: false,
      model: "balance",
      neutrals: 0,
    }));
  };

  /** A new palette from the defaults: nothing loaded, nothing set by hand. */
  const startOver = () => {
    setLch(lchOf(first ?? ""));
    setManual([]);
    setLocked([]);
    setBase(null);
    setPicked(null);
    setSettings(SCHEME_DEFAULTS);
  };

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
    /** The brand colours this was loaded from, when it was. */
    base,
    colors,
    /** True when this colour has been set by hand (and that's switched on). */
    held: (i: number) => individual && i !== anchorAt && Boolean(manual[i]),
    individual,
    loadBrand,
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
    startOver,
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
