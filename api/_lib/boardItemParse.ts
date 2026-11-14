import {
  MAX_COORD,
  MAX_FONT_SIZE,
  MAX_ITEM_SIDE,
  MIN_FONT_SIZE,
  MIN_STORED_SIDE,
} from "../../config/canvas.js";
import { cleanBrowserConfig } from "../../config/nodes/browser.js";
import { isNodeTypeId } from "../../config/nodeTypes.js";
import { normalizeTextStyle, type TextStyle } from "../../config/textStyle.js";
import {
  parseDrawingConfig,
  parseFrameConfig,
  parseNodeConfig,
  parseShaderConfig,
} from "./boardItemConfig.js";
import type { BoardItemKind } from "./boards.js";
import {
  parseImageConfig,
  parseInstanceConfig,
  parseTextConfig,
} from "./layerConfig.js";
import { clamp, num, text } from "./values.js";

/**
 * Nothing reaches the database without passing through here.
 *
 * The three failure rules the constitution names, in one place: geometry and
 * counts are **clamped** rather than refused, a malformed item in a batch is
 * **dropped** so one bad entry does not cost the rest of the save, and only a
 * violation of the whole set is rejected outright. Every rule mirrors a CHECK
 * constraint in db/patches, so a payload that would abort a transaction is
 * refused before the transaction starts.
 */

export const isBoardItemKind = (value: unknown): value is BoardItemKind =>
  value === "photo" ||
  value === "reference" ||
  value === "note" ||
  value === "text" ||
  value === "op" ||
  value === "frame" ||
  value === "shader" ||
  value === "drawing" ||
  value === "component";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Any angle as -180–180 to a tenth of a degree, so 350 and -10 store alike
 * and a junk value is upright.
 */
export const rotationOf = (value: unknown): number => {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const turned = ((((n + 180) % 360) + 360) % 360) - 180;
  return Math.round(turned * 10) / 10 || 0;
};

/** One item as accepted from the client, already validated and clamped. */
export interface IncomingItem {
  body: string | null;
  config: Record<string, unknown> | null;
  creditName: string | null;
  creditUrl: string | null;
  fontSize: number | null;
  height: number;
  id: string;
  imageUrl: string | null;
  kind: BoardItemKind;
  nodeType: string | null;
  photoId: string | null;
  /** Degrees clockwise about the centre, normalised to -180–180. */
  rotation: number;
  textStyle: TextStyle | null;
  thumbUrl: string | null;
  width: number;
  x: number;
  y: number;
  z: number;
}

export interface IncomingSource {
  id: string;
  provider: string;
  title: string | null;
  url: string;
}

export interface IncomingWire {
  id: string;
  sourceItemId: string;
  sourcePort: string;
  targetItemId: string;
  targetPort: string;
}

/** One attached source from the client. Only known providers are stored. */
export const parseIncomingSource = (raw: unknown): IncomingSource | null => {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && UUID_RE.test(o.id) ? o.id : null;
  const url = text(o.url, 2000);
  // An allowlist, like every other value that names an external system.
  const provider = o.provider === "pinterest" ? o.provider : null;
  if (!(id && url && provider)) {
    return null;
  }
  return { id, provider, title: text(o.title, 200), url };
};

export const parseIncomingWire = (raw: unknown): IncomingWire | null => {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const o = raw as Record<string, unknown>;

  const id = typeof o.id === "string" && UUID_RE.test(o.id) ? o.id : null;
  const sourceItemId =
    typeof o.sourceItemId === "string" && UUID_RE.test(o.sourceItemId)
      ? o.sourceItemId
      : null;
  const targetItemId =
    typeof o.targetItemId === "string" && UUID_RE.test(o.targetItemId)
      ? o.targetItemId
      : null;
  const sourcePort = text(o.sourcePort, 60);
  const targetPort = text(o.targetPort, 60);

  if (!(id && sourceItemId && targetItemId && sourcePort && targetPort)) {
    return null;
  }
  return { id, sourceItemId, sourcePort, targetItemId, targetPort };
};

/**
 * Mirrors the CHECK constraint: each kind carries its content in a different
 * column, and an item missing it is refused by the caller with the rest of the
 * save intact rather than aborting the whole transaction.
 */
export const hasRequiredContent = (
  kind: BoardItemKind,
  content: {
    body: string | null;
    config: Record<string, unknown> | null;
    imageUrl: string | null;
    nodeType: string | null;
    photoId: string | null;
  }
): boolean => {
  switch (kind) {
    case "photo":
      return Boolean(content.photoId);
    case "reference":
      return Boolean(content.imageUrl);
    // A note, a plain text item and a frame all carry their content in `body`,
    // which may legitimately be empty — a frame is usually drawn before it is
    // named. Mirrors board_items_shape.
    case "note":
    case "text":
    case "frame":
      return content.body !== null;
    case "op":
      return Boolean(content.nodeType);
    // A shader stack and a drawn mark are both defined entirely by their
    // config; without one there is nothing to render. Mirrors
    // board_items_shape.
    case "shader":
    case "drawing":
    case "component":
      return content.config !== null;
    default:
      return true;
  }
};

/**
 * Each kind's own config, checked by that kind's rules. Built when first
 * asked for rather than at load: boardItemConfig.ts imports this module back,
 * and a table built at load could read its parsers before they exist.
 */
const parserFor = (
  kind: BoardItemKind
): ((raw: unknown) => Record<string, unknown> | null) | undefined =>
  (
    ({
      component: parseInstanceConfig,
      drawing: parseDrawingConfig,
      frame: parseFrameConfig,
      note: parseTextConfig,
      photo: parseImageConfig,
      reference: parseImageConfig,
      shader: parseShaderConfig,
      text: parseTextConfig,
    }) as Partial<
      Record<BoardItemKind, (raw: unknown) => Record<string, unknown> | null>
    >
  )[kind];

const configFor = (
  kind: BoardItemKind,
  nodeType: string | null,
  raw: unknown
): Record<string, unknown> | null => {
  const parse = parserFor(kind);
  if (parse) {
    return parse(raw);
  }
  // A browser node keeps its own shape (config/nodes/browser.ts): a login and
  // session the server sealed, the screenshot, and its markup and notes.
  if (nodeType === "browser") {
    return cleanBrowserConfig(raw);
  }
  return nodeType ? parseNodeConfig(nodeType, raw) : null;
};

/**
 * Validates one item from the client.
 *
 * Returns null for anything malformed rather than throwing: a single bad item
 * in a bulk save should be dropped, not cost the user every other edit they
 * made in the same session.
 */
export const parseIncomingItem = (raw: unknown): IncomingItem | null => {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (!isBoardItemKind(o.kind)) {
    return null;
  }

  // The client generates ids, so an item arrives already identified. Anything
  // that is not a uuid is refused rather than coerced.
  const id = typeof o.id === "string" && UUID_RE.test(o.id) ? o.id : null;
  if (!id) {
    return null;
  }

  const photoId = typeof o.photoId === "string" ? o.photoId : null;
  const imageUrl = text(o.imageUrl, 2000);
  // Notes and text keep an empty body. One is placed before it is written in,
  // and dropping it as malformed made a freshly placed note vanish on the next
  // save. Only a non-string is missing.
  const body = typeof o.body === "string" ? o.body.slice(0, 2000) : null;

  // An operation node is identified by what it does. Validated against the
  // registry rather than a database enum, so an unknown type is refused here
  // instead of reaching a dispatch that has no branch for it.
  const nodeType = isNodeTypeId(o.nodeType) ? o.nodeType : null;

  // Node settings and shader stacks share the column but not the schema: one is
  // checked against the node registry, the other only for shape.
  const config = configFor(o.kind, nodeType, o.config);

  if (
    !hasRequiredContent(o.kind, { body, config, imageUrl, nodeType, photoId })
  ) {
    return null;
  }

  const width = clamp(num(o.width, 320), MIN_STORED_SIDE, MAX_ITEM_SIDE);
  const height = clamp(num(o.height, 240), MIN_STORED_SIDE, MAX_ITEM_SIDE);

  // Clamped rather than trusted: the size is dragged from a control, and a NaN
  // or an absurd value would render text that cannot be read or selected.
  const fontSize =
    o.fontSize === null || o.fontSize === undefined
      ? null
      : clamp(num(o.fontSize, MIN_FONT_SIZE), MIN_FONT_SIZE, MAX_FONT_SIZE);

  return {
    body,
    config,
    creditName: text(o.creditName, 200),
    creditUrl: text(o.creditUrl, 2000),
    fontSize,
    height,
    id,
    imageUrl,
    kind: o.kind,
    nodeType,
    // `result`, `runState` and `runError` are deliberately absent. They arrive
    // in the payload — the canvas holds a copy for display — and are never
    // written from here. The board save replaces the whole arrangement on a
    // debounce, so a save in flight when a generation lands would otherwise
    // write back the pre-run copy and destroy a result that cost money.
    photoId,
    rotation: rotationOf(o.rotation),
    // Allowlisted rather than stored as sent: `text_style` is JSONB, so an
    // unfiltered payload could put anything of any size in it. normalizeTextStyle
    // keeps the eight properties it knows, in range, and drops the rest.
    textStyle: normalizeTextStyle(o.textStyle),
    thumbUrl: text(o.thumbUrl, 2000),
    width,
    // Stored where it is. Clamping to the canvas flattened boards whose print
    // frames ran past it (see MAX_COORD); this only refuses absurd values.
    x: clamp(num(o.x, 0), -MAX_COORD, MAX_COORD),
    y: clamp(num(o.y, 0), -MAX_COORD, MAX_COORD),
    z: Math.trunc(clamp(num(o.z, 0), -9999, 9999)),
  };
};
