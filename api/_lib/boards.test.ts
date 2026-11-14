import { describe, expect, it } from "vitest";
import type { TextStyle } from "../../config/textStyle.js";
import { rowToItemDto } from "./boardDto.js";
import { parseIncomingItem } from "./boardItemParse.js";
import type { BoardItemRow } from "./boards.js";

/**
 * A text item's appearance, all the way to the database and back.
 *
 * Worth a test because the trip has three places to lose something and none of
 * them says so: `parseIncomingItem` allowlists what may be stored, the upsert
 * serialises it into a JSONB column, and `rowToItemDto` filters it again on the
 * way out. A property missing from any one of those simply reverts on the next
 * reload, which reads as "the toolbar did not save" rather than as an error.
 *
 * The database itself is not involved, and does not need to be: JSONB stores
 * what `JSON.stringify` produced and hands it back parsed, which is exactly
 * what the round trip below does.
 */

const ID = "3f1c8ba0-0f6e-4a2f-9a0f-2e2f5b9c1a11";

const STYLE: TextStyle = {
  align: "center",
  color: "#ff00aa",
  family: "fraunces",
  italic: true,
  letterSpacing: 0.08,
  lineHeight: 1.6,
  transform: "uppercase",
  weight: 700,
};

/** An item as the canvas sends it. */
const incoming = (extra: Record<string, unknown> = {}) => ({
  body: "Hello",
  height: 90,
  id: ID,
  kind: "text",
  width: 420,
  x: 100,
  y: 100,
  z: 1,
  ...extra,
});

/**
 * The row the upsert would have written, read back.
 *
 * `JSON.parse(JSON.stringify(...))` is the column: the endpoint stringifies
 * into JSONB, and the driver hands JSONB back already parsed.
 */
const stored = (textStyle: TextStyle | null): BoardItemRow =>
  ({
    body: "Hello",
    created_at: new Date(0).toISOString(),
    credit_name: null,
    credit_url: null,
    font_size: 58,
    height: 90,
    id: ID,
    image_url: null,
    kind: "text",
    photo_id: null,
    text_style:
      textStyle === null ? null : JSON.parse(JSON.stringify(textStyle)),
    thumb_url: null,
    width: 420,
    x: 100,
    y: 100,
    z_index: 1,
  }) as BoardItemRow;

describe("a text item's style, saved and reloaded", () => {
  it("comes back with every property intact", () => {
    const accepted = parseIncomingItem(incoming({ textStyle: STYLE }));
    expect(accepted?.textStyle).toEqual(STYLE);

    const dto = rowToItemDto(stored(accepted?.textStyle ?? null));
    expect(dto.textStyle).toEqual(STYLE);
    expect(dto.fontSize).toBe(58);
  });

  it("reads a row written before the column existed", () => {
    // Every board on the live database is one of these. NULL has to mean "the
    // defaults for the kind", not "a style with nothing in it".
    const dto = rowToItemDto(stored(null));
    expect(dto.textStyle).toBeNull();
    expect(
      rowToItemDto({ ...stored(null), text_style: undefined }).textStyle
    ).toBeNull();
  });

  it("stores nothing at all for an item nobody has styled", () => {
    expect(parseIncomingItem(incoming())?.textStyle).toBeNull();
    expect(
      parseIncomingItem(incoming({ textStyle: {} }))?.textStyle
    ).toBeNull();
  });

  it("drops what the allowlist does not name, on the way in and out", () => {
    const payload = { family: "inter", padding: "9999px", weight: 500 };
    const accepted = parseIncomingItem(incoming({ textStyle: payload }));
    expect(accepted?.textStyle).not.toHaveProperty("padding");
    expect(accepted?.textStyle?.family).toBe("inter");

    // And again on the way out, for a row that never went through the parser.
    const dto = rowToItemDto({ ...stored(null), text_style: payload });
    expect(dto.textStyle).not.toHaveProperty("padding");
    expect(dto.textStyle?.weight).toBe(500);
  });

  it("keeps the item when the style is nonsense, rather than losing the text", () => {
    // A malformed style is a reason to ignore the style, never a reason to drop
    // the words someone typed.
    const accepted = parseIncomingItem(incoming({ textStyle: "big and red" }));
    expect(accepted?.body).toBe("Hello");
    expect(accepted?.textStyle).toBeNull();
  });
});

describe("where an item is", () => {
  it("is kept as sent, past the canvas and above or left of it", () => {
    const placed = parseIncomingItem(incoming({ x: 14_646, y: -1200 }));
    expect([placed?.x, placed?.y]).toEqual([14_646, -1200]);
    const tall = parseIncomingItem(incoming({ height: 10_800, width: 7200 }));
    expect([tall?.width, tall?.height]).toEqual([7200, 10_800]);
  });

  it("keeps a design's thin layers their size", () => {
    // A 20-unit bar along a banner's foot was saved 40 tall, so each reload
    // pushed its centre past the frame and it dropped out of the design.
    const bar = parseIncomingItem(incoming({ height: 20, width: 1584 }));
    expect([bar?.width, bar?.height]).toEqual([1584, 20]);
    const rule = parseIncomingItem(incoming({ height: 2.5, width: 12 }));
    expect([rule?.width, rule?.height]).toEqual([12, 2.5]);
    expect(parseIncomingItem(incoming({ height: 0 }))?.height).toBe(1);
  });
});

describe("a text item's size", () => {
  it("keeps poster-sized type, which print frames at 300 dpi need", () => {
    expect(parseIncomingItem(incoming({ fontSize: 1400 }))?.fontSize).toBe(
      1400
    );
    expect(parseIncomingItem(incoming({ fontSize: 99_999 }))?.fontSize).toBe(
      5000
    );
  });
});

describe("a frame's settings", () => {
  it("keeps only whether it has been designed", () => {
    const frame = (config: unknown) =>
      parseIncomingItem(incoming({ body: "Post", config, kind: "frame" }))
        ?.config;
    expect(frame({ designed: true, junk: 1 })).toEqual({ designed: true });
    expect(frame({ designed: "yes" })).toBeNull();
    expect(frame(null)).toBeNull();
  });

  it("keeps the guides dragged onto it, and nothing off the frame", () => {
    const frame = (config: unknown) =>
      parseIncomingItem(incoming({ body: "Post", config, kind: "frame" }))
        ?.config;
    expect(
      frame({ guides: { hideSafe: true, x: [0.25, 2, "a"], y: [0.5] } })
    ).toEqual({ guides: { hideSafe: true, x: [0.25], y: [0.5] } });
    expect(frame({ guides: { x: [], y: [] } })).toBeNull();
  });
});

describe("a browser node's settings", () => {
  it("keeps where it is, its sealed login and session, its screenshot, and clean notes", () => {
    const config = parseIncomingItem(
      incoming({
        config: {
          captureHeight: 900,
          captureUrl: "https://blob.example.com/a.png",
          captureWidth: 1440,
          junk: "x",
          loginUser: "dallas@example.com",
          marks: [
            {
              id: "m",
              kind: "box",
              points: [
                [0.1, 0.1],
                [0.4, 0.3],
              ],
            },
            { kind: "nope" },
          ],
          notes: [
            { body: "b", id: "n", kind: "issue", title: "t", x: 2, y: 0.5 },
          ],
          pageUrl: "https://app.example.com/home",
          sealedLogin: "v1.a.b.c",
          session: "v1.d.e.f",
          url: "javascript:alert(1)",
          viewport: "mobile",
        },
        kind: "op",
        nodeType: "browser",
      })
    )?.config as Record<string, unknown>;
    expect(config.junk).toBeUndefined();
    expect(config.url).toBe("");
    expect(config.pageUrl).toBe("https://app.example.com/home");
    expect(config.sealedLogin).toBe("v1.a.b.c");
    expect(config.captureUrl).toBe("https://blob.example.com/a.png");
    expect(config.marks).toHaveLength(1);
    expect((config.notes as { x: number }[])[0]?.x).toBe(1);
    expect(config.viewport).toBe("mobile");
  });
});
