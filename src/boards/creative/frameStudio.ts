import { useEffect, useState } from "react";
import type { TypeScale } from "../../../config/typeScale.js";
import type { BoardItem } from "../../types";
import { recipeOf, type StudioRecipe } from "../studio/types";
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
  /** "Edit in Studio" for a layer, when it was made in the Studio. */
  const studioEditorFor = (layer: BoardItem) =>
    recipeOf(layer.config) ? () => editInStudio(layer) : undefined;
  return { editId, setStudio, studio, studioEditorFor };
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
  patch,
  size,
  studio,
}: {
  add: (item: BoardItem) => void;
  applyType: (scale: TypeScale) => void;
  editId: string | null;
  frame: BoardItem;
  items: BoardItem[];
  layers: BoardItem[];
  name: string;
  patch: (id: string, next: Partial<BoardItem>) => void;
  size: { h: number; w: number } | null;
  studio: string | null;
}) => {
  if (!studio) {
    return null;
  }
  /** A Studio picture placed in the frame: as a layer, or behind everything. */
  const place = async (
    file: File,
    asBackground: boolean,
    made?: StudioRecipe
  ) => {
    const layer = await studioLayer(file, frame, items, layers, asBackground);
    add(made ? { ...layer, config: { studio: made } } : layer);
  };
  const target = layers.find((l) => l.id === editId) ?? null;
  const recipe = target ? recipeOf(target.config) : null;
  return {
    editing:
      target && recipe
        ? {
            layerId: target.id,
            onReplace: (file: File, next: StudioRecipe) =>
              void replaceStudioLayer(file, next, target, patch),
            recipe,
          }
        : undefined,
    frame: {
      name,
      onApplyType: applyType,
      onBackground: (file: File, next: StudioRecipe) =>
        void place(file, true, next),
      size,
    },
    onAdd: (file: File, next?: StudioRecipe) => void place(file, false, next),
    tool: studio,
  };
};
