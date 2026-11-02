import type { TextStyle } from "../../../config/textStyle";
import type { BoardItem } from "../../types";
import { requestHistory } from "../hooks/historyRequest";
import type { Command } from "../shortcuts/keys";
import { arrangeCommands } from "./arrangeCommands";
import { layerKind, type Reorder, type ShapeTool } from "./creativeModel";
import { normalizeAngle, rotationOf } from "./rotate";
import type { AlignTo, useLayerSelection } from "./selection";
import type { EditorUi } from "./useEditorCommands";

/**
 * The frame editor's commands, each with its name, group and keys: the one
 * list the key handler, the shortcut sheet (?) and the command palette (⌘K)
 * all read. The operations behind them live in useEditorCommands.ts.
 */

/** Layers copied with ⌘C, kept for ⌘V across frames while the page is open. */
let clipboard: BoardItem[] = [];

export interface EditorOps {
  align: (to: AlignTo) => void;
  background: BoardItem | null;
  chosen: BoardItem[];
  copyMany: (group: BoardItem[]) => void;
  cycle: (step: 1 | -1) => void;
  each: (fn: (l: BoardItem) => Partial<BoardItem>) => void;
  layers: BoardItem[];
  nudge: (dx: number, dy: number) => void;
  one: BoardItem | null;
  order: (id: string, how: Reorder) => void;
  patchMany: (patches: Map<string, Partial<BoardItem>>) => void;
  removeMany: (ids: string[]) => void;
  resizeText: (factor: number) => void;
  selection: ReturnType<typeof useLayerSelection>;
  setEditingId: (id: string | null) => void;
  shape: (tool: ShapeTool) => void;
  some: boolean;
  text: (role: "body" | "headline") => void;
  textStyle: (fn: (s: TextStyle | null) => Partial<TextStyle>) => void;
  toBoard: (group: BoardItem[]) => void;
  ui: EditorUi;
}

export const editorCommandList = (ops: EditorOps): Command[] => {
  const {
    background,
    chosen,
    copyMany,
    cycle,
    each,
    layers,
    one,
    removeMany,
    selection,
    setEditingId,
    shape,
    some,
    text,
    toBoard,
    ui,
  } = ops;
  return [
    // Add
    {
      group: "Add",
      id: "add-headline",
      keys: ["t"],
      label: "Headline",
      run: () => text("headline"),
    },
    {
      group: "Add",
      id: "add-body",
      keys: ["shift+t"],
      label: "Body text",
      run: () => text("body"),
    },
    {
      group: "Add",
      id: "add-rect",
      keys: ["r"],
      label: "Rectangle",
      run: () => shape("rect"),
    },
    {
      group: "Add",
      id: "add-rounded",
      keys: ["shift+r"],
      label: "Rounded rectangle",
      run: () => shape("rounded"),
    },
    {
      group: "Add",
      id: "add-ellipse",
      keys: ["o"],
      label: "Ellipse",
      run: () => shape("ellipse"),
    },
    {
      group: "Add",
      id: "add-squircle",
      keys: ["q"],
      label: "Squircle",
      run: () => shape("squircle"),
    },
    {
      group: "Add",
      id: "add-triangle",
      keys: ["y"],
      label: "Triangle",
      run: () => shape("triangle"),
    },
    {
      group: "Add",
      id: "add-polygon",
      keys: ["p"],
      label: "Polygon",
      run: () => shape("polygon"),
    },
    {
      group: "Add",
      id: "add-star",
      keys: ["s"],
      label: "Star",
      run: () => shape("star"),
    },
    {
      group: "Add",
      id: "add-line",
      keys: ["l"],
      label: "Line",
      run: () => shape("line"),
    },
    {
      group: "Add",
      id: "add-arrow",
      keys: ["shift+l"],
      label: "Arrow",
      run: () => shape("arrow"),
    },
    {
      group: "Add",
      id: "images",
      keys: ["i"],
      label: "Brand images",
      run: ui.toggleImages,
    },
    {
      group: "Add",
      id: "generate",
      keys: ["g"],
      label: "Generate a picture",
      run: ui.toggleGenerate,
    },
    {
      group: "Add",
      id: "studio",
      keys: ["shift+s"],
      label: "Open the Studio",
      run: ui.openStudio,
    },
    {
      group: "Add",
      id: "paste",
      keys: ["mod+v"],
      label: "Paste layers",
      // Checked when run: copying doesn't re-render, so a render-time
      // `enabled` would still be false straight after ⌘C.
      run: () => {
        if (clipboard.length > 0) {
          copyMany(clipboard);
        }
      },
    },
    // Select
    {
      group: "Select",
      id: "select-all",
      keys: ["mod+a"],
      label: "Select every layer",
      run: () =>
        selection.setIds(
          layers.filter((l) => l !== background).map((l) => l.id)
        ),
    },
    {
      enabled: layers.length > 0,
      group: "Select",
      id: "select-next",
      keys: ["Tab"],
      label: "Next layer",
      run: () => cycle(1),
    },
    {
      enabled: layers.length > 0,
      group: "Select",
      id: "select-previous",
      keys: ["shift+Tab"],
      label: "Previous layer",
      run: () => cycle(-1),
    },
    // Edit
    {
      enabled: one !== null && layerKind(one) === "text",
      group: "Edit",
      id: "edit-text",
      keys: ["Enter"],
      label: "Edit the text",
      run: () => setEditingId(one?.id ?? null),
    },
    {
      enabled: some,
      group: "Edit",
      id: "duplicate",
      keys: ["mod+d"],
      label: "Duplicate",
      run: () => copyMany(chosen),
    },
    {
      enabled: some,
      group: "Edit",
      id: "to-board",
      keys: ["shift+b"],
      label: "Move to the board",
      run: () => toBoard(chosen),
    },
    {
      enabled: some,
      group: "Edit",
      id: "copy",
      keys: ["mod+c"],
      label: "Copy",
      run: () => {
        clipboard = chosen;
      },
    },
    {
      enabled: some,
      group: "Edit",
      id: "cut",
      keys: ["mod+x"],
      label: "Cut",
      run: () => {
        clipboard = chosen;
        removeMany(chosen.map((l) => l.id));
      },
    },
    {
      enabled: some,
      group: "Edit",
      id: "delete",
      keys: ["Delete", "Backspace"],
      label: "Delete",
      run: () => removeMany(chosen.map((l) => l.id)),
    },
    {
      enabled: some,
      group: "Edit",
      id: "rotate-right",
      keys: ["]"],
      label: "Rotate 15° clockwise",
      run: () =>
        each((l) => ({ rotation: normalizeAngle(rotationOf(l) + 15) })),
    },
    {
      enabled: some,
      group: "Edit",
      id: "rotate-left",
      keys: ["["],
      label: "Rotate 15° anticlockwise",
      run: () =>
        each((l) => ({ rotation: normalizeAngle(rotationOf(l) - 15) })),
    },
    {
      enabled: some,
      group: "Edit",
      id: "rotate-reset",
      keys: ["shift+0"],
      label: "Straighten",
      run: () => each(() => ({ rotation: 0 })),
    },
    ...arrangeCommands(ops),
    // History
    {
      group: "Edit",
      id: "undo",
      keys: ["mod+z"],
      label: "Undo",
      run: () => requestHistory(false),
    },
    {
      group: "Edit",
      id: "redo",
      keys: ["shift+mod+z", "mod+y"],
      label: "Redo",
      run: () => requestHistory(true),
    },
    // View
    {
      group: "View",
      id: "toggle-rail",
      keys: ["mod+\\"],
      label: "Show or hide the layers panel",
      run: () => ui.togglePanel("left"),
    },
    {
      group: "View",
      id: "toggle-side",
      keys: ["shift+mod+\\"],
      label: "Show or hide the brand panel",
      run: () => ui.togglePanel("right"),
    },
    {
      group: "View",
      id: "palette",
      keys: ["mod+k"],
      label: "Command palette",
      run: ui.openPalette,
    },
    {
      group: "View",
      id: "shortcuts",
      keys: ["?"],
      label: "Keyboard shortcuts",
      run: ui.openShortcuts,
    },
    {
      group: "View",
      id: "close",
      keys: ["mod+Enter"],
      label: "Done: back to the board",
      run: ui.close,
    },
  ];
};
