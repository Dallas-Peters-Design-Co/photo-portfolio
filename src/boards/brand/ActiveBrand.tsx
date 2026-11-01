import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useBrandKits } from "../../hooks/useBrandKits";
import type { BrandKit } from "../../services/brandKitService";

/**
 * The brand a board is being worked in.
 *
 * Chosen in the Brand panel and remembered per board in this browser, so
 * opening the Bird Creek board brings Bird Creek's colours back to every colour
 * picker without a step. It is a working preference rather than part of the
 * board: a board can hold work for several brands, and switching shouldn't
 * write a save.
 */

interface ActiveBrandValue {
  kit: BrandKit | null;
  kits: BrandKit[];
  setKitId: (id: string | null) => void;
}

const ActiveBrandContext = createContext<ActiveBrandValue | null>(null);

const storageKey = (boardId: string) => `board-brand:${boardId}`;

const readStored = (boardId: string): string | null => {
  try {
    return localStorage.getItem(storageKey(boardId));
  } catch {
    return null;
  }
};

export function ActiveBrandProvider({
  boardId,
  children,
}: {
  boardId: string;
  children: ReactNode;
}) {
  const { kits } = useBrandKits();
  const [kitId, setKitIdState] = useState<string | null>(() =>
    readStored(boardId)
  );
  const setKitId = useCallback(
    (id: string | null) => {
      setKitIdState(id);
      try {
        if (id) {
          localStorage.setItem(storageKey(boardId), id);
        } else {
          localStorage.removeItem(storageKey(boardId));
        }
      } catch {
        // Private windows can refuse storage; the choice still holds for now.
      }
    },
    [boardId]
  );
  const value = useMemo<ActiveBrandValue>(
    () => ({
      kit: kits.find((k) => k.id === kitId) ?? null,
      kits,
      setKitId,
    }),
    [kits, kitId, setKitId]
  );
  return (
    <ActiveBrandContext.Provider value={value}>
      {children}
    </ActiveBrandContext.Provider>
  );
}

/** The board's brand, or null outside a board (ColorWell is used elsewhere). */
export const useActiveBrand = (): ActiveBrandValue | null =>
  useContext(ActiveBrandContext);

/** The active brand's colours, as the colour picker's preset swatches. */
export const useBrandSwatches = ():
  | { color: string; title: string }[]
  | undefined => {
  const brand = useActiveBrand();
  const palette = brand?.kit?.resolvedDoc.palette ?? [];
  return palette.length > 0
    ? palette.map((p) => ({
        color: p.value,
        title: [p.name, p.role].filter(Boolean).join(" · ") || p.value,
      }))
    : undefined;
};
