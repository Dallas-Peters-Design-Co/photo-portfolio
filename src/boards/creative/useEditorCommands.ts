import type { BrandKitDoc } from "../../../config/brandKit.js";
import { normalizeTextStyle, type TextStyle } from "../../../config/textStyle";
import type { TypeScale } from "../../../config/typeScale.js";
import type { BoardItem } from "../../types";
import { applyTypeScale } from "./applyTypeScale";
import {
  duplicate,
  layerKind,
  moveInStack,
  newShape,
  newText,
  patchItems,
  type Reorder,
  reorder,
  type ShapeTool,
} from "./creativeModel";
import { editorCommandList } from "./editorCommandList";
import { type AlignTo, alignLayers, type useLayerSelection } from "./selection";

/**
 * Everything the frame editor can do, as named commands with their keys:
 * adding, selecting, arranging, editing, text, and opening its panels. The key
 * handler, the shortcut sheet and the command palette all read this one list,
 * so a command added here is reachable all three ways.
 */

export interface EditorUi {
  close: () => void;
  openPalette: () => void;
  openShortcuts: () => void;
  openStudio: () => void;
  toggleGenerate: () => void;
  toggleImages: () => void;
  togglePanel: (side: "left" | "right") => void;
}

export const useEditorCommands = ({
  kitDoc = null,
  background,
  brandFill,
  frame,
  items,
  layers,
  onChange,
  selection,
  setEditingId,
  ui,
}: {
  /** The active brand kit, for its faces when applying a type scale. */
  kitDoc?: BrandKitDoc | null;
  background: BoardItem | null;
  brandFill: string;
  frame: BoardItem | undefined;
  items: BoardItem[];
  layers: BoardItem[];
  onChange: (next: BoardItem[]) => void;
  selection: ReturnType<typeof useLayerSelection>;
  setEditingId: (id: string | null) => void;
  ui: EditorUi;
}) => {
  const chosen = layers.filter((l) => selection.ids.includes(l.id));
  const one = chosen.length === 1 ? (chosen[0] ?? null) : null;
  const some = chosen.length > 0;

  const patchMany = (patches: Map<string, Partial<BoardItem>>) =>
    onChange(patchItems(items, patches));
  const patch = (id: string, next: Partial<BoardItem>) =>
    patchMany(new Map([[id, next]]));
  const each = (fn: (l: BoardItem) => Partial<BoardItem>) =>
    patchMany(new Map(chosen.map((l) => [l.id, fn(l)])));

  const add = (item: BoardItem) => {
    onChange([...items, item]);
    selection.select(item.id);
  };
  const removeMany = (ids: string[]) => {
    onChange(items.filter((item) => !ids.includes(item.id)));
    selection.select(null);
  };
  const copyMany = (group: BoardItem[], into = items) => {
    const copies: BoardItem[] = [];
    for (const layer of group) {
      copies.push(duplicate(layer, [...into, ...copies]));
    }
    onChange([...into, ...copies]);
    selection.setIds(copies.map((c) => c.id));
  };
  const order = (id: string, how: Reorder) =>
    patchMany(
      new Map([...reorder(layers, id, how)].map(([key, z]) => [key, { z }]))
    );
  const restack = (ids: string[], before: string | null) =>
    patchMany(
      new Map(
        [...moveInStack(layers, ids, before)].map(([id, z]) => [id, { z }])
      )
    );
  const shape = (tool: ShapeTool) => {
    if (frame) {
      add(newShape(frame, items, tool, brandFill));
    }
  };
  const text = (role: "body" | "headline") => {
    if (frame) {
      add(newText(frame, items, role));
    }
  };
  const nudge = (dx: number, dy: number) =>
    each((l) => ({ x: l.x + dx, y: l.y + dy }));
  /** One layer aligns to the frame; several align to each other. */
  const align = (to: AlignTo) => {
    if (one && frame) {
      patchMany(alignLayers([one, { ...frame, id: "__frame" }], to));
      return;
    }
    patchMany(alignLayers(chosen, to));
  };
  const textStyle = (fn: (s: TextStyle | null) => Partial<TextStyle>) =>
    patchMany(
      new Map(
        chosen
          .filter((l) => layerKind(l) === "text")
          .map((l) => [
            l.id,
            {
              textStyle: normalizeTextStyle({
                ...(l.textStyle ?? {}),
                ...fn(l.textStyle ?? null),
              }),
            },
          ])
      )
    );
  const resizeText = (factor: number) =>
    each((l) =>
      layerKind(l) === "text"
        ? { fontSize: Math.max(8, Math.round((l.fontSize ?? 32) * factor)) }
        : {}
    );
  /** Tab and ⇧Tab walk the layers front to back, as the list shows them. */
  const cycle = (step: 1 | -1) => {
    const frontFirst = [...layers].reverse();
    const at = one ? frontFirst.indexOf(one) : -1;
    const next = frontFirst.at(
      (at + step + frontFirst.length) % frontFirst.length
    );
    selection.select(next?.id ?? null);
  };

  const commands = editorCommandList({
    align,
    background,
    chosen,
    copyMany,
    cycle,
    each,
    layers,
    nudge,
    one,
    order,
    patchMany,
    removeMany,
    resizeText,
    selection,
    setEditingId,
    shape,
    some,
    text,
    textStyle,
    ui,
  });

  /** The brand's type scale onto every text layer (applyTypeScale.ts). */
  const applyType = (scale: TypeScale) => {
    if (frame) {
      patchMany(applyTypeScale(scale, frame, layers, kitDoc));
    }
  };

  return {
    add,
    applyTypeScale: applyType,
    chosen,
    commands,
    copyMany,
    one,
    order,
    patch,
    patchMany,
    removeMany,
    restack,
    shape,
    text,
  };
};
