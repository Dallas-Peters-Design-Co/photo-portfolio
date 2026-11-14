import { type ReactNode, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { BoardItem } from "../../types";
import { useActiveBrand } from "../brand/ActiveBrand";
import { newItemId } from "../io/newItemId";
import { DEFAULT_PALETTE } from "../studio/tools";
import { ColorVarsDialog } from "./ColorVarsDialog";
import {
  type ColorVar,
  nameFor,
  recolourItems,
  rgbOf,
  varFor,
} from "./colorVars";
import { recolourComponents, redrawStudioLayers } from "./followThrough";
import { ColorVarsContext, type ColorVarsValue } from "./useColorVars";

/**
 * The board's colour variables, for every colour picker on it: pick one to
 * use it, change one and every layer with that colour changes too
 * (colorVars.ts), along with the components and Studio pictures using it.
 */

/** What the board editor hands over: its list and its items. */
export interface ColorVarsDoc {
  change: (next: BoardItem[]) => void;
  /** The board's items as they are now, edits not yet rendered included. */
  latest: () => BoardItem[];
  save: (next: ColorVar[]) => void | Promise<void>;
  vars: ColorVar[];
}

interface Refs {
  doc: { current: ColorVarsDoc };
  palette: { current: string[] };
  setEditing: (open: boolean) => void;
}

const plural = (n: number, word: string) =>
  n ? `${n} ${word}${n > 1 ? "s" : ""}` : "";

/** The components and Studio pictures a change reaches, after the board. */
const followThrough = async (
  refs: Refs,
  ids: string[],
  from: string,
  to: string
) => {
  const { change, latest } = refs.doc.current;
  try {
    const swap = (oldId: string, next: BoardItem) =>
      change(latest().map((i) => (i.id === oldId ? next : i)));
    const [pictures, components] = await Promise.all([
      redrawStudioLayers(latest(), ids, refs.palette.current, swap),
      recolourComponents(latest(), from, to),
    ]);
    const done = [
      plural(pictures, "Studio picture"),
      plural(components, "component"),
    ].filter(Boolean);
    if (done.length > 0) {
      toast.success(`${done.join(" and ")} updated`);
    }
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : "Couldn't update everything"
    );
  }
};

/** Changes a variable's colour, and that colour across the board. */
const setValueOf = (
  refs: Refs,
  vars: ColorVar[],
  id: string,
  colour: string
) => {
  const was = vars.find((v) => v.id === id);
  const to = rgbOf(colour);
  if (!(was && to) || rgbOf(was.value) === to) {
    return;
  }
  const clash = vars.find((v) => v.id !== id && rgbOf(v.value) === to);
  if (clash) {
    toast.error(`${clash.name} is already that colour`);
    return;
  }
  const { change, latest, save } = refs.doc.current;
  const { changed, items } = recolourItems(latest(), was.value, to);
  if (changed.length > 0) {
    change(items);
  }
  void save(vars.map((v) => (v.id === id ? { ...v, value: to } : v)));
  void followThrough(refs, changed, was.value, to);
};

const valueFor = (vars: ColorVar[], refs: Refs): ColorVarsValue => {
  const save = (next: ColorVar[]) => void refs.doc.current.save(next);
  return {
    add: (colour, name) => {
      const rgb = rgbOf(colour);
      if (!rgb) {
        return null;
      }
      const had = varFor(rgb, vars);
      if (had) {
        return had;
      }
      const made = {
        id: newItemId(),
        name: nameFor(name ?? "Colour", vars),
        value: rgb,
      };
      save([...vars, made]);
      return made;
    },
    addAll: (list) => {
      const next = [...vars];
      for (const { name, value } of list) {
        const rgb = rgbOf(value);
        if (rgb && !varFor(rgb, next)) {
          next.push({ id: newItemId(), name: nameFor(name, next), value: rgb });
        }
      }
      save(next);
    },
    close: () => refs.setEditing(false),
    open: () => refs.setEditing(true),
    remove: (id) => save(vars.filter((v) => v.id !== id)),
    rename: (id, name) =>
      save(
        vars.map((v) =>
          v.id === id
            ? {
                ...v,
                name: nameFor(
                  name,
                  vars.filter((o) => o.id !== id)
                ),
              }
            : v
        )
      ),
    setValue: (id, colour) => setValueOf(refs, vars, id, colour),
    vars,
  };
};

export function ColorVarsProvider({
  children,
  doc,
}: {
  children: ReactNode;
  doc: ColorVarsDoc;
}) {
  const [editing, setEditing] = useState(false);
  const brand = useActiveBrand();
  const entries = brand?.kit?.resolvedDoc.palette ?? [];
  const brandPalette =
    entries.length > 0 ? entries.map((p) => p.value) : DEFAULT_PALETTE;
  // Read at call time: a change and its follow-through can land together.
  const docRef = useRef(doc);
  docRef.current = doc;
  const paletteRef = useRef(brandPalette);
  paletteRef.current = brandPalette;

  const value = useMemo<ColorVarsValue>(
    () =>
      valueFor(doc.vars, {
        doc: docRef,
        palette: paletteRef,
        setEditing,
      }),
    [doc.vars]
  );

  return (
    <ColorVarsContext.Provider value={value}>
      {children}
      {editing ? <ColorVarsDialog brand={brandPalette} /> : null}
    </ColorVarsContext.Provider>
  );
}

/** The board editor's side of it, kept stable between renders. */
export const useColorVarsDoc = (
  vars: ColorVar[] | undefined,
  pending: { current: { items: BoardItem[] } },
  change: (next: BoardItem[]) => void,
  save: (next: ColorVar[]) => void | Promise<void>
): ColorVarsDoc => {
  const list = vars ?? EMPTY;
  const fns = useRef({ change, save });
  fns.current = { change, save };
  return useMemo(
    () => ({
      change: (next) => fns.current.change(next),
      latest: () => pending.current.items,
      save: (next) => fns.current.save(next),
      vars: list,
    }),
    [list, pending]
  );
};

const EMPTY: ColorVar[] = [];
