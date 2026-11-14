import { useCallback, useEffect, useState } from "react";
import {
  apiBase,
  jsonHeaders,
  readPageError,
} from "../../services/portfolioService";
import type { StudioValues } from "./types";

/**
 * Saved Studio settings: a tool's settings under a name, kept on the site
 * (api/_lib/studioPresets.ts), so the same look can be made on the next
 * frame without remembering eleven sliders.
 */

export interface StudioPreset {
  id: string;
  name: string;
  tool: string;
  updatedAt: string;
  values: StudioValues;
}

/** Settings that belong to one picture, not to a look: kept out of presets. */
const OWN = new Set(["painted"]);

export const lookOf = (values: StudioValues): StudioValues =>
  Object.fromEntries(Object.entries(values).filter(([k]) => !OWN.has(k)));

const call = async (body: Record<string, unknown>, fallback: string) => {
  const res = await fetch(`${apiBase()}/api/brand-kits`, {
    body: JSON.stringify(body),
    headers: jsonHeaders(),
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(await readPageError(res, fallback));
  }
  return res;
};

export const presetsApi = {
  list: async (): Promise<StudioPreset[]> => {
    const res = await fetch(`${apiBase()}/api/brand-kits?presets=1`, {
      headers: jsonHeaders(),
    });
    if (!res.ok) {
      throw new Error(await readPageError(res, "Couldn't load presets"));
    }
    return (await res.json()) as StudioPreset[];
  },
  remove: async (id: string): Promise<void> => {
    await call({ action: "deletePreset", id }, "Couldn't delete it");
  },
  save: async (preset: {
    id?: string;
    name: string;
    tool: string;
    values: StudioValues;
  }): Promise<StudioPreset> =>
    (await (
      await call(
        { action: "savePreset", ...preset, values: lookOf(preset.values) },
        "Couldn't save the preset"
      )
    ).json()) as StudioPreset,
};

/** One tool's presets, loaded once and kept in step as they change. */
export const usePresets = (tool: string) => {
  const [all, setAll] = useState<StudioPreset[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    presetsApi
      .list()
      .then((list) => alive && setAll(list))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);
  const keep = useCallback(
    (p: StudioPreset) =>
      setAll((was) =>
        [...was.filter((x) => x.id !== p.id), p].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      ),
    []
  );
  const drop = useCallback(
    (id: string) => setAll((was) => was.filter((x) => x.id !== id)),
    []
  );
  return {
    drop,
    error,
    keep,
    presets: all.filter((p) => p.tool === tool),
  };
};

/** The settings a tool was last left at in this browser, across Studio opens. */
const lastKey = (tool: string) => `board-studio:last:${tool}`;

export const lastValues = (tool: string): StudioValues | undefined => {
  try {
    const raw = localStorage.getItem(lastKey(tool));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as StudioValues)
      : undefined;
  } catch {
    return undefined;
  }
};

export const rememberValues = (tool: string, values: StudioValues) => {
  try {
    localStorage.setItem(lastKey(tool), JSON.stringify(lookOf(values)));
  } catch {
    // Private windows and full storage: the settings just aren't remembered.
  }
};
