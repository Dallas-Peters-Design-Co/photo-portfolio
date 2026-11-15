import { describe, expect, it } from "vitest";
import { EMPTY_KIT, resolveKitDoc, sanitizeKitDoc } from "./brandKit.js";
import {
  applyConceptStyle,
  applyReviewStyles,
  type ConceptStyle,
  cleanConceptStyles,
  linkStyle,
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

  it("keeps the settings it set itself", () => {
    const drawn = applyConceptStyle(
      button({ overrides: ["background"], styleId: "primary" }),
      [primary]
    );
    expect(drawn.background).toBe("#000000");
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
