import { describe, expect, it } from "vitest";
import { EMPTY_KIT, resolveKitDoc, sanitizeKitDoc } from "./brandKit.js";
import { createConceptElement } from "./conceptDefaults.js";
import {
  applyConceptStyle,
  applyReviewStyles,
  type ConceptStyle,
  CUSTOM_CELL_STYLE,
  cleanConceptStyles,
  fromStyle,
  linkStyle,
  styleElement,
  withOverrides,
} from "./conceptStyle.js";
import { DEFAULT_REVIEW_DOC } from "./review.js";
import { cleanConcept, type ReviewConceptElement } from "./reviewConcept.js";

const primary: ConceptStyle = {
  id: "primary",
  kind: "button",
  look: {
    background: "#ff0000",
    color: "#ffffff",
    fontFamily: "sans",
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.2,
    paddingX: 20,
    paddingY: 10,
    radius: 999,
  },
  name: "Primary",
};

const button = (more: Partial<ReviewConceptElement> = {}) =>
  cleanConcept({
    elements: [{ background: "#000000", kind: "button", text: "Go", ...more }],
  }).elements[0] as ReviewConceptElement;

describe("cleaning kit styles", () => {
  it("keeps a valid style and checks its look like an element's", () => {
    const [style] = cleanConceptStyles([
      { ...primary, look: { ...primary.look, color: "red", fontSize: 500 } },
    ]);
    expect(style?.look.background).toBe("#ff0000");
    expect(style?.look.color).toBe("#172033");
    expect(style?.look.fontSize).toBe(72);
  });

  it("drops a style without a usable id, and duplicates", () => {
    expect(
      cleanConceptStyles([{ ...primary, id: "<x>" }, primary, primary])
    ).toHaveLength(1);
  });

  it("keeps a table style's borders and header", () => {
    const [style] = cleanConceptStyles([
      {
        id: "t",
        kind: "table",
        look: {
          tableBorders: { lines: "grid", outline: true, width: 2 },
          tableHeader: { background: "#eeeeee" },
        },
        name: "Grid",
      },
    ]);
    expect(style?.look.tableBorders).toEqual({
      lines: "grid",
      outline: true,
      width: 2,
    });
    expect(style?.look.tableHeader).toEqual({ background: "#eeeeee" });
  });
});

describe("a linked element", () => {
  it("draws as its style, keeping its content", () => {
    const drawn = applyConceptStyle(button({ styleId: "primary" }), [primary]);
    expect(drawn).toMatchObject({
      background: "#ff0000",
      radius: 999,
      text: "Go",
    });
  });

  it("keeps an instance's flex override when the kit exposes it", () => {
    const flex = { basis: 120, grow: 1, shrink: 0 };
    const drawn = applyConceptStyle(
      button({ flex, overrides: ["background", "flex"], styleId: "primary" }),
      [{ ...primary, overridableProps: ["flex"] }]
    );
    expect(drawn.flex).toEqual(flex);
    expect(drawn.background).toBe(primary.look.background);
    expect(drawn.color).toBe("#ffffff");
  });

  it("is left as it is when its style is gone or of another kind", () => {
    const element = button({ styleId: "primary" });
    expect(applyConceptStyle(element, [])).toBe(element);
    expect(applyConceptStyle(element, [{ ...primary, kind: "badge" }])).toBe(
      element
    );
  });

  it("marks an edited style setting as its own, and content edits not at all", () => {
    const linked = applyConceptStyle(button({ styleId: "primary" }), [primary]);
    expect(withOverrides(linked, { background: "#00ff00" }).overrides).toEqual([
      "background",
    ]);
    expect(withOverrides(linked, { text: "Buy" }).overrides).toBeUndefined();
    expect(withOverrides(button(), { background: "#00ff00" })).toEqual({
      background: "#00ff00",
    });
  });

  it("links, resets (clearing its own settings), and unlinks", () => {
    const own = button({ overrides: ["background"], styleId: "primary" });
    const reset = linkStyle(own, primary);
    expect(reset.overrides).toBeUndefined();
    expect(reset.background).toBe("#ff0000");
    const free = linkStyle(reset, null);
    expect(free.styleId).toBeUndefined();
    expect(free.background).toBe("#ff0000");
  });
});

describe("kits and reviews", () => {
  it("keeps styles on a saved kit, and a sub-brand inherits them", () => {
    const parent = sanitizeKitDoc({ ...EMPTY_KIT, componentStyles: [primary] });
    expect(parent.componentStyles).toHaveLength(1);
    expect(resolveKitDoc(EMPTY_KIT, parent).componentStyles).toHaveLength(1);
  });

  it("styles the concepts on every screen of a review", () => {
    const doc = applyReviewStyles(
      {
        ...DEFAULT_REVIEW_DOC,
        screens: [
          {
            id: "s",
            image: null,
            marks: [],
            note: "",
            pins: [
              {
                body: "",
                concepts: [
                  cleanConcept({
                    elements: [{ kind: "button", styleId: "primary" }],
                  }),
                ],
                id: "p",
                kind: "recommendation",
                title: "",
                x: 0,
                y: 0,
              },
            ],
            sourceUrl: "",
            title: "",
            viewport: "desktop",
          },
        ],
      },
      [primary]
    );
    expect(
      doc.screens[0]?.pins[0]?.concepts?.[0]?.elements[0]?.background
    ).toBe("#ff0000");
  });
});

describe("review fixes", () => {
  it("keeps a card's own icon size and colour when its style sets none", () => {
    const card = cleanConcept({
      elements: [
        {
          iconColor: "#00ff00",
          iconName: "StarIcon",
          iconSize: 50,
          kind: "card",
          styleId: "c",
        },
      ],
    }).elements[0] as ReviewConceptElement;
    const [plain] = cleanConceptStyles([
      { id: "c", kind: "card", look: {}, name: "C" },
    ]);
    const drawn = applyConceptStyle(card, [plain as ConceptStyle]);
    expect(drawn).toMatchObject({ iconColor: "#00ff00", iconSize: 50 });
  });

  it("lets a style hold an icon size and colour", () => {
    const [style] = cleanConceptStyles([
      {
        id: "c",
        kind: "card",
        look: { iconColor: "#ff0000", iconSize: 40 },
        name: "C",
      },
    ]);
    expect(style?.look).toMatchObject({ iconColor: "#ff0000", iconSize: 40 });
  });

  it("marks a typeface change as all three font settings", () => {
    const linked = applyConceptStyle(button({ styleId: "primary" }), [primary]);
    const { overrides } = withOverrides(linked, {
      fontFamily: "brand",
      fontRef: "g:Inter",
    });
    expect(overrides).toEqual(["fontFamily", "fontId", "fontRef"]);
  });

  it("styles an older table that only has column names", () => {
    const old = cleanConcept({
      elements: [{ kind: "table", options: ["Name"], styleId: "t" }],
    }).elements[0] as ReviewConceptElement;
    const [grid] = cleanConceptStyles([
      {
        id: "t",
        kind: "table",
        look: { tableBorders: { lines: "grid", outline: false, width: 1 } },
        name: "Grid",
      },
    ]);
    const drawn = applyConceptStyle(old, [grid as ConceptStyle]);
    expect(drawn.table?.borders?.lines).toBe("grid");
    expect(drawn.table?.columns[0]?.label).toBe("Name");
  });
});

describe("a style's icon", () => {
  const heart = [["path", { d: "M1 1h2" }]] as [
    string,
    Record<string, string>,
  ][];
  const [stat] = cleanConceptStyles([
    {
      id: "stat",
      kind: "card",
      look: { iconName: "FavouriteIcon", iconSvg: heart },
      name: "Stat",
    },
  ]);
  const card = (more: Partial<ReviewConceptElement> = {}) =>
    cleanConcept({ elements: [{ kind: "card", styleId: "stat", ...more }] })
      .elements[0] as ReviewConceptElement;

  it("is kept by the style, and drawn on linked elements", () => {
    expect(stat?.look.iconName).toBe("FavouriteIcon");
    expect(applyConceptStyle(card(), [stat as ConceptStyle]).iconName).toBe(
      "FavouriteIcon"
    );
  });

  it("gives way to an icon the element picked itself, name and drawing together", () => {
    const linked = applyConceptStyle(card(), [stat as ConceptStyle]);
    const { overrides } = withOverrides(linked, { iconName: "StarIcon" });
    expect(overrides).toEqual(["iconName", "iconSvg"]);
  });

  it("is not invented by cleaning when the style sets none", () => {
    const [plain] = cleanConceptStyles([
      { id: "p", kind: "card", look: {}, name: "P" },
    ]);
    expect(plain?.look.iconName).toBeUndefined();
  });
});

it("never blanks an element's basic settings for a style that lacks them", () => {
  const drawn = applyConceptStyle(button({ styleId: "bare" }), [
    { id: "bare", kind: "button", look: {}, name: "Bare" },
  ]);
  expect(drawn.fontWeight).toBeDefined();
  expect(drawn.background).toBe("#000000");
});

it("lets a checkbox style set the accent and box size", () => {
  const [style] = cleanConceptStyles([
    {
      id: "ok",
      kind: "checkbox",
      look: { accentColor: "#12b76a", checkSize: 22 },
      name: "Ok",
    },
  ]);
  const box = cleanConcept({ elements: [{ kind: "checkbox", styleId: "ok" }] })
    .elements[0] as ReviewConceptElement;
  expect(applyConceptStyle(box, [style as ConceptStyle])).toMatchObject({
    accentColor: "#12b76a",
    checkSize: 22,
  });
});

describe("table cells that follow kit styles", () => {
  const pill: ConceptStyle = {
    id: "pill",
    kind: "badge",
    look: { background: "#ecfdf3", color: "#027a48", radius: 999 },
    name: "Success",
  };
  const table = (styleId: string | undefined, kind = "tag") =>
    cleanConcept({
      elements: [
        {
          kind: "table",
          table: {
            columns: [{ kind, label: "Status", styleId }],
            rows: [["Active"]],
          },
        },
      ],
    }).elements[0] as ReviewConceptElement;

  it("gives a linked tag column its badge style's look", () => {
    const drawn = styleElement(table("pill"), [pill]);
    expect(drawn.table?.columns[0]?.look).toMatchObject({
      background: "#ecfdf3",
      color: "#027a48",
      radius: 999,
    });
  });

  it("ignores a style of the wrong kind, and keeps the last look when it is gone", () => {
    expect(
      styleElement(table("pill", "button"), [pill]).table?.columns[0]?.look
    ).toBeUndefined();
    const drawn = styleElement(table("pill"), [pill]);
    expect(styleElement(drawn, []).table?.columns[0]?.look?.background).toBe(
      "#ecfdf3"
    );
  });

  it("gives a tag column that picked no style the kit's first badge", () => {
    expect(
      styleElement(table(undefined), [pill]).table?.columns[0]?.look
    ).toMatchObject({ background: "#ecfdf3", radius: 999 });
  });

  it("leaves a column set to Custom in its own colour", () => {
    expect(
      styleElement(table(CUSTOM_CELL_STYLE), [pill]).table?.columns[0]?.look
    ).toBeUndefined();
  });
});

describe("a panel style's starting items", () => {
  const panel = createConceptElement("panel");
  const close = { ...createConceptElement("button"), text: "Done" };
  const style: ConceptStyle = cleanConceptStyles([
    {
      id: "panelstyle1",
      kind: "panel",
      look: { contents: { hide: { elements: [close] } } },
      name: "Primary",
    },
  ])[0] as ConceptStyle;

  it("keeps them through cleaning", () => {
    expect(style.look.contents?.hide?.elements[0]?.text).toBe("Done");
  });

  it("gives a new panel the kit's items, each with a new id", () => {
    const made = fromStyle(panel, style);
    const item = made.slots?.hide?.elements[0];
    expect(item?.text).toBe("Done");
    expect(item?.id).not.toBe(close.id);
    expect(Object.keys(made.slots ?? {})).toEqual(["hide"]);
  });

  it("leaves a panel already following the style its own items", () => {
    const own = linkStyle(panel, style);
    expect(own.slots).toEqual(panel.slots);
  });
});

it("saves a kit grid group with sized children and inserts independent copies", () => {
  const group = createConceptElement("group");
  const child = {
    ...createConceptElement("button"),
    flex: { basis: 120, grow: 2, shrink: 0 },
  };
  const [style] = cleanConceptStyles([
    {
      id: "actions",
      kind: "group",
      look: {
        groupContents: {
          columns: 3,
          elements: [child],
          gap: 16,
          layout: "grid",
        },
      },
      name: "Actions",
    },
  ]);
  if (!style) {
    throw new Error("Missing group style");
  }
  const first = fromStyle(group, style);
  const second = fromStyle(group, style);
  expect(first.group).toMatchObject({
    columns: 3,
    elements: [{ flex: child.flex }],
    gap: 16,
    layout: "grid",
  });
  expect(first.group?.elements[0]?.id).not.toBe(second.group?.elements[0]?.id);
});
