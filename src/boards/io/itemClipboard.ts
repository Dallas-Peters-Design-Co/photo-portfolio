import { containedBy } from "../../../config/graph.js";
import type { BoardItem, BoardWire } from "../../types";
import { copyOfFrames } from "./copyToBoard";

/**
 * Cut, copy and paste of board items: one clipboard shared by the board and
 * the frame editor, so what's copied in one pastes in the other.
 *
 * Copied items go on the system clipboard as a web custom format, which the
 * browser carries between tabs and boards; the plain-text part is only a
 * label, so pasting into another app gives a short note rather than JSON.
 * The same bundle is also held in memory, for a paste on this page from a
 * shortcut that never sees a clipboard event (the frame editor's ⌘V).
 *
 * A bundle keeps the items as they were. Ids are minted when it's pasted
 * (copyOfFrames), so every paste is a fresh copy and nothing pasted can
 * reach back into what it was copied from.
 */

export const CLIP_TYPE = "application/x-dallas-board-items+json";

export interface ClipBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ClipBundle {
  /** The frame the layers were copied out of, for placing them in another. */
  from: ClipBox | null;
  items: BoardItem[];
  /** A short description, the clipboard's plain text. */
  label: string;
  wires: BoardWire[];
}

let held: ClipBundle | null = null;
/** How many times the held bundle has been pasted, to step each paste on. */
let pastes = 0;

/** The bundle copied last on this page, if any. */
export const heldClip = (): ClipBundle | null => held;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * What's copied: the chosen items plus everything on any chosen frame, each
 * once, and the wires that run between them.
 */
export const bundleOf = (
  chosen: BoardItem[],
  items: BoardItem[],
  wires: BoardWire[],
  from: ClipBox | null = null
): ClipBundle => {
  const seen = new Set<string>();
  const all: BoardItem[] = [];
  for (const item of chosen.flatMap((c) =>
    c.kind === "frame" ? [c, ...containedBy(c, items)] : [c]
  )) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      all.push(item);
    }
  }
  return {
    from,
    items: all,
    label: `${plural(all.length, "item")} copied from a board`,
    wires: wires.filter(
      (w) => seen.has(w.sourceItemId) && seen.has(w.targetItemId)
    ),
  };
};

/** Keeps the bundle for this page and, from a copy or cut event, the system. */
export const holdClip = (bundle: ClipBundle, event?: ClipboardEvent): void => {
  held = bundle;
  pastes = 0;
  const data = event?.clipboardData;
  if (!data) {
    return;
  }
  data.setData("text/plain", bundle.label);
  try {
    data.setData(CLIP_TYPE, JSON.stringify(bundle));
  } catch {
    // A browser without web custom formats keeps the in-memory copy only.
  }
};

const parse = (raw: string): ClipBundle | null => {
  try {
    const value = JSON.parse(raw) as Partial<ClipBundle>;
    return Array.isArray(value.items) && value.items.length > 0
      ? {
          from: value.from ?? null,
          items: value.items,
          label: String(value.label ?? ""),
          wires: Array.isArray(value.wires) ? value.wires : [],
        }
      : null;
  } catch {
    return null;
  }
};

/**
 * Board items on a paste event's clipboard: the custom format, or the bundle
 * held here when the clipboard still has its label (a browser that dropped
 * the custom format). Anything else copied since wins.
 */
export const clipFrom = (event: ClipboardEvent): ClipBundle | null => {
  const data = event.clipboardData;
  if (!data) {
    return null;
  }
  const raw = data.getData(CLIP_TYPE);
  if (raw) {
    return parse(raw);
  }
  return held && data.getData("text/plain") === held.label ? held : null;
};

const boundsOf = (items: BoardItem[]): ClipBox => {
  const x = Math.min(...items.map((i) => i.x));
  const y = Math.min(...items.map((i) => i.y));
  return {
    height: Math.max(...items.map((i) => i.y + i.height)) - y,
    width: Math.max(...items.map((i) => i.x + i.width)) - x,
    x,
    y,
  };
};

/** The step between repeated pastes over the originals. */
const STEP = 40;

/**
 * Where a paste on the board puts the group's top-left corner: a step on
 * from the originals while they're still on this board (so a copy never
 * hides under them, and each further paste steps on again), otherwise
 * centred where you're looking.
 */
export const boardPasteSpot = (
  bundle: ClipBundle,
  existing: BoardItem[],
  centre: { x: number; y: number },
  repeat: number
): { x: number; y: number } => {
  const box = boundsOf(bundle.items);
  const ids = new Set(existing.map((i) => i.id));
  if (bundle.items.some((i) => ids.has(i.id))) {
    return { x: box.x + STEP * repeat, y: box.y + STEP * repeat };
  }
  return {
    x: Math.round(centre.x - box.width / 2),
    y: Math.round(centre.y - box.height / 2),
  };
};

/** The pasted copies, stacked above everything already there in their order. */
const onTop = (copies: BoardItem[], existing: BoardItem[]): BoardItem[] => {
  const top = Math.max(0, ...existing.map((i) => i.z));
  const order = [...copies].sort((a, b) => a.z - b.z).map((c) => c.id);
  return copies.map((c) => ({ ...c, z: top + 1 + order.indexOf(c.id) }));
};

/** The bundle as new board items and wires, at the spot a paste should use. */
export const pasteOnBoard = (
  bundle: ClipBundle,
  existing: BoardItem[],
  centre: { x: number; y: number }
): { items: BoardItem[]; wires: BoardWire[] } => {
  pastes = bundle === held ? pastes + 1 : 1;
  const at = boardPasteSpot(bundle, existing, centre, pastes);
  const copy = copyOfFrames(bundle.items, bundle.items, bundle.wires, at);
  return { items: onTop(copy.items, existing), wires: copy.wires };
};

/** Item kinds a frame can hold as layers (creativeModel.layerKind). */
const LAYER_KINDS = new Set([
  "component",
  "drawing",
  "note",
  "photo",
  "reference",
  "text",
]);

/**
 * Layers to paste into a frame: the bundle's own layers (nodes and frames
 * can't go in one), moved from the frame they came from to the same place
 * in this one, or centred in it when they came off the board. Pasted back
 * into the frame they came from, they're stepped on from the originals
 * (`nudge`), so the copy doesn't hide under them.
 */
export const layersForFrame = (
  bundle: ClipBundle,
  frame: ClipBox
): { layers: BoardItem[]; nudge: boolean } => {
  const layers = bundle.items.filter((i) => LAYER_KINDS.has(i.kind));
  if (layers.length === 0) {
    return { layers, nudge: false };
  }
  const { from } = bundle;
  const same =
    from !== null &&
    from.x === frame.x &&
    from.y === frame.y &&
    from.width === frame.width &&
    from.height === frame.height;
  if (same) {
    return { layers, nudge: true };
  }
  const box = boundsOf(layers);
  const dx = from
    ? frame.x - from.x
    : frame.x + (frame.width - box.width) / 2 - box.x;
  const dy = from
    ? frame.y - from.y
    : frame.y + (frame.height - box.height) / 2 - box.y;
  return {
    layers: layers.map((l) => ({
      ...l,
      x: Math.round(l.x + dx),
      y: Math.round(l.y + dy),
    })),
    nudge: false,
  };
};
