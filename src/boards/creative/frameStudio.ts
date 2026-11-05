import { useEffect, useState } from "react";
import type { TypeScale } from "../../../config/typeScale.js";
import type { BoardItem } from "../../types";
import { recipeOf, type StudioRecipe } from "../studio/types";
import { renderCreative } from "./exportPng";
import { replaceStudioLayer, studioLayer } from "./studioLayer";

/**
 * The Studio as the frame editor uses it: which tool is open, and the placed
 * Studio picture it was opened on to change, if any. A picture placed from
 * the Studio carries its recipe (tool, settings, size, source picture), so
 * "Edit in Studio" reopens it as it was and "Update the layer" swaps the
 * result in where the old one sat.
 */
export const useFrameStudio = () => {
  const [studio, setStudio] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  useEffect(() => {
    if (!studio) {
      setEditId(null);
    }
  }, [studio]);
  /** The Studio, opened on a placed picture to change it. */
  const editInStudio = (layer: BoardItem) => {
    const recipe = recipeOf(layer.config);
    if (recipe) {
      setStudio(recipe.tool);
      setEditId(layer.id);
    }
  };
  /** The layer being edited became a new one (replaceStudioLayer). */
  const retarget = (id: string) => setEditId(id);
  /** "Edit in Studio" for a layer, when it was made in the Studio. */
  const studioEditorFor = (layer: BoardItem) =>
    recipeOf(layer.config) ? () => editInStudio(layer) : undefined;
  return { editId, retarget, setStudio, studio, studioEditorFor };
};

/** The box around some layers (their unrotated boxes). */
const boundsOf = (layers: BoardItem[]) => {
  const x = Math.min(...layers.map((l) => l.x));
  const y = Math.min(...layers.map((l) => l.y));
  const right = Math.max(...layers.map((l) => l.x + l.width));
  const bottom = Math.max(...layers.map((l) => l.y + l.height));
  return {
    height: Math.max(1, bottom - y),
    width: Math.max(1, right - x),
    x,
    y,
  };
};

/** What EditorOverlays needs to show the Studio for this frame. */
export const frameStudioProps = ({
  add,
  applyType,
  editId,
  frame,
  items,
  layers,
  name,
  selected,
  size,
  studio,
  swap,
  textElementFor,
}: {
  add: (item: BoardItem) => void;
  applyType: (scale: TypeScale) => void;
  editId: string | null;
  frame: BoardItem;
  items: BoardItem[];
  layers: BoardItem[];
  name: string;
  /** The layers selected in the editor. */
  selected: string[];
  size: { h: number; w: number } | null;
  studio: string | null;
  /** Puts a new layer in an old one's place. */
  swap: (oldId: string, next: BoardItem) => void;
  textElementFor: (id: string) => HTMLElement | null;
}) => {
  if (!studio) {
    return null;
  }
  /**
   * A Studio picture placed in the frame: as a layer, behind everything, or
   * (made from the selection in place) over the whole frame, on top, so its
   * tiles land exactly where the selection is.
   */
  const place = async (
    file: File,
    how: "background" | "fit" | "over",
    made?: StudioRecipe
  ) => {
    const covers = how !== "fit";
    const layer = await studioLayer(file, frame, items, layers, covers);
    const z =
      how === "over" ? Math.max(0, ...layers.map((l) => l.z)) + 1 : layer.z;
    add({ ...layer, z, ...(made ? { config: { studio: made } } : {}) });
  };
  const target = layers.find((l) => l.id === editId) ?? null;
  const recipe = target ? recipeOf(target.config) : null;
  /**
   * The frame as a picture, for a Studio tool to work from (a mosaic of the
   * selection): the selected layers, or the whole design when nothing is,
   * never the picture being edited itself.
   */
  const picked = layers.filter(
    (l) => selected.includes(l.id) && l.id !== editId
  );
  const from =
    picked.length > 0 ? picked : layers.filter((l) => l.id !== editId);
  // A selection is drawn cropped to its own edges, so it fills the picture
  // (and the mosaic made from it); nothing selected is the whole frame.
  const box = picked.length > 0 ? boundsOf(picked) : frame;
  const width = Math.min(2400, Math.max(800, size?.w ?? 1600));
  const snapshot = () => renderCreative(box, from, width, textElementFor);
  /** The selection where it sits, the rest of the frame left clear. */
  const snapshotInPlace =
    picked.length > 0
      ? () => renderCreative(frame, picked, width, textElementFor)
      : undefined;
  return {
    editing:
      target && recipe
        ? {
            layerId: target.id,
            onReplace: (file: File, next: StudioRecipe) =>
              void replaceStudioLayer(file, next, target, swap),
            recipe,
          }
        : undefined,
    frame: {
      name,
      onApplyType: applyType,
      onBackground: (file: File, next: StudioRecipe) =>
        void place(file, "background", next),
      onOver: (file: File, next: StudioRecipe) =>
        void place(file, "over", next),
      selectionCount: picked.length,
      size,
      snapshot,
      snapshotInPlace,
    },
    onAdd: (file: File, next?: StudioRecipe) => void place(file, "fit", next),
    tool: studio,
  };
};
