import useSWR from "swr";
import { useBrandKits } from "../hooks/useBrandKits";
import type { BrandKit } from "../services/brandKitService";
import {
  apiBase,
  authStorage,
  jsonHeaders,
  readPageError,
} from "../services/portfolioService";
import { createNeutralEdit, type EditState } from "./adjustments";
import {
  applyLookAtStrength,
  LOOKS,
  type Look,
  type LookFamily,
} from "./presets";

/**
 * Looks beyond the built-in families: the ones Dallas saved by name, and one
 * per brand kit that has a look. Both become ordinary `Look`s, so the strip,
 * the strength slider and applyLookAtStrength treat them like any other.
 *
 * Ids are namespaced so a brand kit can point at either kind:
 *   built-in  "a3"            (presets.ts)
 *   saved     "saved:<uuid>"  (patch 046)
 *   brand     "brand:<kitId>" (only in the editor; a kit can't point at a kit)
 */

export const SAVED_FAMILY = "saved";
const WHITESPACE = /\s+/;
const SAVED_PREFIX = /^saved:/;
export const BRAND_FAMILY = "brands";

/** The strip tab for saved looks, shared by the editor and the kit picker. */
export const SAVED_LOOK_FAMILY: LookFamily = {
  color: "#f4f4f2",
  contrastColor: "#111111",
  description: "Looks you saved by name",
  id: SAVED_FAMILY,
  letter: "★",
  name: "Saved",
};

export interface SavedLook {
  edit: Partial<EditState>;
  id: string;
  name: string;
  updatedAt: string;
}

const LOOKS_URL = () => `${apiBase()}/api/brand-kits`;

export const savedLooksApi = {
  list: async (): Promise<SavedLook[]> => {
    const res = await fetch(`${LOOKS_URL()}?looks=1`, {
      headers: jsonHeaders(),
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not load saved looks"));
    }
    return (await res.json()) as SavedLook[];
  },
  remove: async (id: string): Promise<void> => {
    const res = await fetch(LOOKS_URL(), {
      body: JSON.stringify({ action: "deleteLook", id }),
      headers: jsonHeaders(),
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not delete the look"));
    }
  },
  /** Creates, or replaces the look with `id`. */
  save: async (
    name: string,
    edit: EditState,
    id?: string
  ): Promise<SavedLook> => {
    const res = await fetch(LOOKS_URL(), {
      body: JSON.stringify({ action: "saveLook", edit, id, name }),
      headers: jsonHeaders(),
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Could not save the look"));
    }
    return (await res.json()) as SavedLook;
  },
};

/** Two letters for the strip tile: "Bird Creek Warm" → "BC". */
export const initialsOf = (name: string): string => {
  const words = name.trim().split(WHITESPACE).filter(Boolean);
  const letters =
    words.length > 1
      ? (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")
      : name.trim().slice(0, 2);
  return letters.toUpperCase() || "?";
};

/**
 * The stored edit merged onto neutral, so a look saved before an adjustment
 * existed still opens, and a stored value of the wrong type falls back.
 */
export const savedLookEdit = (edit: Partial<EditState>): EditState => {
  const out: EditState = createNeutralEdit();
  const target = out as Record<string, unknown>;
  for (const [key, base] of Object.entries(createNeutralEdit())) {
    const value = (edit as Record<string, unknown>)[key];
    if (
      typeof base === "number" &&
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      target[key] = value;
    } else if (Array.isArray(base) && Array.isArray(value)) {
      target[key] = value;
    } else if (isObject(base) && isObject(value)) {
      target[key] = value;
    }
  }
  // Optional stages: absent on a neutral edit, so carried across by type.
  if (isObject(edit.curve)) {
    out.curve = edit.curve;
  }
  if (typeof edit.lutId === "string") {
    out.lutId = edit.lutId;
  }
  return out;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

export const savedToLook = (saved: SavedLook, index: number): Look => ({
  code: initialsOf(saved.name),
  edit: savedLookEdit(saved.edit),
  family: SAVED_FAMILY,
  id: `saved:${saved.id}`,
  index: index + 1,
  name: saved.name,
});

/** Any look a kit can point at, built-in or saved. */
export const findLook = (id: string, saved: SavedLook[]): Look | null => {
  if (id.startsWith("saved:")) {
    const i = saved.findIndex((s) => `saved:${s.id}` === id);
    const found = saved[i];
    return found ? savedToLook(found, i) : null;
  }
  return LOOKS.find((l) => l.id === id) ?? null;
};

/**
 * One look per brand kit that has one: the kit's chosen look at the kit's
 * strength, named after the brand. Resolved kits, so a sub-brand that leaves
 * its look unset uses its parent's.
 */
export const brandLooks = (kits: BrandKit[], saved: SavedLook[]): Look[] =>
  kits.flatMap((kit, i) => {
    const ref = kit.resolvedDoc.look;
    const base = ref ? findLook(ref.id, saved) : null;
    if (!(ref && base)) {
      return [];
    }
    return [
      {
        code: initialsOf(kit.name),
        edit: applyLookAtStrength(base, ref.strength),
        family: BRAND_FAMILY,
        id: `brand:${kit.id}`,
        index: i + 1,
        name: `${kit.name} · ${base.name}`,
      },
    ];
  });

const looksKey = () =>
  ["saved-looks", Boolean(authStorage.getToken())] as const;

/** Saved looks and brand looks for the editor, plus save and delete. */
export const useExtraLooks = () => {
  const { data, mutate } = useSWR(looksKey, () => savedLooksApi.list(), {
    revalidateOnFocus: false,
  });
  const { kits } = useBrandKits();
  const saved = data ?? [];
  return {
    brands: brandLooks(kits, saved),
    remove: async (lookId: string) => {
      await savedLooksApi.remove(lookId.replace(SAVED_PREFIX, ""));
      await mutate();
    },
    save: async (name: string, edit: EditState) => {
      const look = await savedLooksApi.save(name, edit);
      await mutate();
      return savedToLook(look, saved.length);
    },
    saved,
    savedLooks: saved.map(savedToLook),
  };
};
